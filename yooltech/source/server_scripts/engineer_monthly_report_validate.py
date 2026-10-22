# Server Script — "Engineer Monthly Report Validate"
# Script Type: DocType Event | Reference Doctype: Engineer Monthly Report | Event: Before Save (validate)
#
# 1. Ownership: non-managers can only create/edit their own report (engineer = session user).
#    New reports are owned by the engineer, so the Agent "if owner" permission works even when a
#    manager generated the report.
# 2. Status flow (field status, no Workflow, no emails): Draft -> Submitted (engineer or manager),
#    Submitted -> Approved (manager, Head Comment required), Submitted -> Draft (manager).
#    Non-managers cannot change a report once it is Submitted/Approved.
# 3. Suggested challenge rows the engineer deleted are remembered in dismissed_suggestions (JSON list of
#    ticket names) so a refresh does not add them again.
# 4. When doc.flags.yool_refresh is set (API yool_engineer_report_generate / _refresh), the ticket data is
#    re-pulled: activities and summary numbers are replaced; challenges, feedback and head_comment typed
#    by people are never removed, only new rows are added.
# safe_exec: no imports, no tuple unpacking, no "d[k] += x", no _-prefixed attributes, no def helpers that
# need script-level names (so everything is inline).

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))

if not doc.engineer:
    frappe.throw("Please select the Engineer.", title="Engineer required")
if not frappe.db.exists("HD Agent", doc.engineer):
    frappe.throw("The Engineer must be a Helpdesk agent.", title="Not an agent")
if not is_manager and doc.engineer != user:
    frappe.throw("You can only create or edit your own Engineer Monthly Report.", title="Not permitted")

doc.engineer_name = (
    frappe.db.get_value("HD Agent", doc.engineer, "agent_name")
    or frappe.db.get_value("User", doc.engineer, "full_name")
    or doc.engineer
)
if not doc.period_type:
    doc.period_type = "Month"
if not doc.from_date or not doc.to_date:
    frappe.throw("Please set From Date and To Date.", title="Period required")
from_date = frappe.utils.getdate(doc.from_date)
to_date = frappe.utils.getdate(doc.to_date)
if from_date > to_date:
    frappe.throw("From Date cannot be after To Date.", title="Invalid period")
doc.report_date = to_date

duplicate = frappe.db.sql(
    "SELECT name FROM `tabEngineer Monthly Report` WHERE engineer = %(e)s AND from_date = %(f)s"
    " AND to_date = %(t)s AND name != %(n)s LIMIT 1",
    {"e": doc.engineer, "f": from_date, "t": to_date, "n": doc.name or ""},
)
if duplicate:
    frappe.throw(
        "A report for this engineer and period already exists: " + duplicate[0][0] + ".",
        title="Duplicate report",
    )

# The engineer owns the report (Agent permission is "if owner"), also when a manager made or moved it.
doc.owner = doc.engineer
old = None
if not doc.is_new():
    old = doc.get_doc_before_save()

# ---------- status flow ----------
old_status = (old.status if old else "Draft") or "Draft"
new_status = doc.status or "Draft"
doc.status = new_status
if doc.is_new() and new_status != "Draft" and not is_manager:
    frappe.throw("A new report must start as Draft.", title="Not permitted")
if old and old_status != new_status:
    allowed = False
    if old_status == "Draft" and new_status == "Submitted":
        allowed = True
    elif old_status == "Submitted" and new_status == "Approved" and is_manager:
        allowed = True
    elif old_status == "Submitted" and new_status == "Draft" and is_manager:
        allowed = True
    if not allowed:
        frappe.throw(
            "Status cannot change from " + old_status + " to " + new_status + " for you.",
            title="Not permitted",
        )
    if new_status == "Approved" and not (doc.head_comment or "").strip():
        frappe.throw("Please write the Head Comment before approving this report.", title="Head Comment required")
elif old and not is_manager and old_status != "Draft":
    frappe.throw(
        "This report is " + old_status + ". Only an Agent Manager can change it now.",
        title="Not permitted",
    )

# ---------- head comment: managers only ----------
if not is_manager:
    old_comment = (old.head_comment if old else None) or ""
    if (doc.head_comment or "") != old_comment:
        frappe.throw("Only an Agent Manager can write the Head Comment.", title="Not permitted")

# ---------- remember deleted suggestions ----------
dismissed = []
try:
    dismissed = json.loads(doc.dismissed_suggestions or "[]") or []
except Exception:
    dismissed = []
present = [c.source_ticket for c in (doc.challenges or []) if c.source_ticket]
if old:
    for c in (old.challenges or []):
        if c.suggested and c.source_ticket and c.source_ticket not in present and c.source_ticket not in dismissed:
            dismissed.append(c.source_ticket)

# ---------- re-pull ticket data (only when the API asks for it) ----------
if doc.flags.yool_refresh:
    eng = doc.engineer
    escaped = eng.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = frappe.db.sql(
        "SELECT t.name, t.subject, t.status, COALESCE(s.category, t.status_category) AS category,"
        " t.customer, COALESCE(cu.customer_name, t.erp_customer_name) AS client,"
        " t.opening_date, t.agreement_status, t.solved_by, t.time_spent, t.resolution_details,"
        " t.feedback, t.feedback_rating, t.feedback_extra, t._assign AS assign_json"
        " FROM `tabHD Ticket` t"
        " LEFT JOIN `tabHD Ticket Status` s ON s.name = t.status"
        " LEFT JOIN `tabCustomer` cu ON cu.name = t.customer"
        " WHERE t.opening_date BETWEEN %(f)s AND %(t)s AND t._assign LIKE %(pat)s"
        " ORDER BY t.opening_date ASC, t.creation ASC",
        {"f": from_date, "t": to_date, "pat": '%"' + escaped + '"%'},
        as_dict=True,
    )
    # Same rule as the Agent Ticket Report: the exact user must be in the _assign JSON.
    tickets = []
    for r in rows:
        users = []
        try:
            users = json.loads(r.assign_json or "[]") or []
        except Exception:
            users = []
        if eng in users:
            tickets.append(r)
    names = [r.name for r in tickets]

    # Visit cost = Bajaaj expense (GL 5225, posted only by Expense Bill), same source as the Agent Ticket
    # Report. Bills with hd_ticket go to that ticket; otherwise a bill of this agent (Employee.user_id) is
    # matched to the agent's ticket of the same customer opened on the bill's date, each bill to one ticket.
    cost = {}
    e_values = {"account": "5225 - Bajaaj Expense - YT", "f": from_date, "t": to_date}
    ticket_cond = ""
    if names:
        ticket_cond = " OR eb.hd_ticket IN %(names)s"
        e_values["names"] = tuple(names)
    expenses = frappe.db.sql(
        "SELECT gle.voucher_no, SUM(gle.debit - gle.credit) AS amount,"
        " COALESCE(eb.customer, IF(gle.party_type = 'Customer', gle.party, NULL)) AS expense_customer,"
        " eb.hd_ticket, emp.user_id AS agent_user, eb.expense_date, MIN(gle.posting_date) AS posting_date"
        " FROM `tabGL Entry` gle"
        " LEFT JOIN `tabExpense Bill` eb ON gle.voucher_type = 'Expense Bill' AND eb.name = gle.voucher_no"
        " LEFT JOIN `tabEmployee` emp ON emp.name = eb.employee"
        " WHERE gle.account = %(account)s AND gle.is_cancelled = 0"
        " AND (gle.posting_date BETWEEN %(f)s AND %(t)s" + ticket_cond + ")"
        " GROUP BY gle.voucher_type, gle.voucher_no, expense_customer, eb.hd_ticket, emp.user_id, eb.expense_date"
        " ORDER BY MIN(gle.posting_date), gle.voucher_no",
        e_values,
        as_dict=True,
    )
    for e in expenses:
        amount = frappe.utils.flt(e.amount, 2)
        if not amount:
            continue
        if e.hd_ticket:
            if e.hd_ticket in names:
                cost[e.hd_ticket] = cost.get(e.hd_ticket, 0) + amount
            continue
        if e.agent_user != eng or not e.expense_customer:
            continue
        bill_day = str(e.expense_date or e.posting_date)
        candidates = [x.name for x in tickets if x.customer == e.expense_customer and str(x.opening_date) == bill_day]
        if not candidates:
            continue
        free = [c for c in candidates if not cost.get(c)]
        target = free[0] if free else candidates[0]
        cost[target] = cost.get(target, 0) + amount

    # Activity rows are updated in place by ticket (same row names), so the version history only shows
    # real changes; rows for tickets no longer in the period are dropped, new tickets are added.
    existing_rows = {}
    for a in (doc.activities or []):
        if a.ticket and a.ticket not in existing_rows:
            existing_rows[a.ticket] = a
    new_rows = []
    resolved = 0
    missing_time = 0
    total_cost = 0
    visited = []
    customers = []
    ranked = []  # [-minutes, position, ticket] for the "3 longest" suggestions (no lambdas/key needed)
    for r in tickets:
        visit_cost = frappe.utils.flt(cost.get(r.name, 0), 2)
        solved_by = r.solved_by or ("Visit" if visit_cost > 0 else "Office")
        # time_spent is Data "h:mm" (normalized by Server Script "HD Ticket Time Spent").
        minutes = 0
        ts_parts = str(r.time_spent or "").strip().split(":")
        if len(ts_parts) == 2 and ts_parts[0].isdigit() and ts_parts[1].isdigit():
            minutes = int(ts_parts[0]) * 60 + int(ts_parts[1])
        if minutes > 0:
            mm = str(minutes % 60)
            if len(mm) < 2:
                mm = "0" + mm
            time_text = str(int(minutes // 60)) + ":" + mm
            ranked.append([-minutes, len(ranked), r])
        else:
            time_text = "—"
            missing_time = missing_time + 1
        done = r.category == "Resolved" or r.status in ("Resolved", "Closed")
        if done:
            resolved = resolved + 1
        if r.customer and r.customer not in customers:
            customers.append(r.customer)
        if solved_by == "Visit" and r.customer and r.customer not in visited:
            visited.append(r.customer)
        total_cost = total_cost + visit_cost
        values = {
            "ticket": r.name,
            "activity_date": r.opening_date,
            "client_name": (r.client or "").strip(),
            "issue": r.subject,
            "solved_by": solved_by,
            "time_spent_text": time_text,
            "activity_status": "Done" if done else "Pending",
            "visit_cost": visit_cost,
        }
        row = existing_rows.get(r.name)
        if row:
            row.update(values)
            new_rows.append(row)
        else:
            new_rows.append(values)

    doc.set("activities", new_rows)
    position = 0
    for a in doc.activities:
        position = position + 1
        a.idx = position

    new_clients = 0
    if customers:
        firsts = frappe.db.sql(
            "SELECT customer, MIN(opening_date) AS first_date FROM `tabHD Ticket`"
            " WHERE customer IN %(c)s GROUP BY customer",
            {"c": tuple(customers)},
            as_dict=True,
        )
        for x in firsts:
            if x.first_date and from_date <= frappe.utils.getdate(x.first_date) <= to_date:
                new_clients = new_clients + 1

    doc.works_done = len(tickets)
    doc.issues_resolved = resolved
    doc.new_clients = new_clients
    doc.clients_visited = len(visited)
    doc.missing_time_count = missing_time
    doc.total_visit_cost = frappe.utils.flt(total_cost, 2)
    doc.last_refreshed = frappe.utils.now_datetime()

    # Suggested challenges: every SLA-failed ticket, then the 3 longest time_spent tickets.
    suggestions = [r for r in tickets if r.agreement_status == "Failed"]
    for item in sorted(ranked, key=lambda x: [x[0], x[1]])[:3]:
        if item[2] not in suggestions:
            suggestions.append(item[2])
    present = [c.source_ticket for c in (doc.challenges or []) if c.source_ticket]
    for r in suggestions:
        if r.name in present or r.name in dismissed:
            continue
        solution = ""
        if r.resolution_details:
            try:
                solution = frappe.utils.strip_html(r.resolution_details) or ""
            except Exception:
                solution = r.resolution_details or ""
            solution = " ".join(solution.replace("&nbsp;", " ").split())
            if len(solution) > 500:
                solution = solution[:497] + "..."
        doc.append("challenges", {
            "challenge": (r.subject or "").strip() + " (" + ((r.client or "").strip() or "-") + ", ticket " + r.name + ")",
            "solution": solution,
            "suggested": 1,
            "source_ticket": r.name,
        })
        present.append(r.name)

    # Feedback: stored ticket feedback not yet in the table; 2 empty rows if there is none at all.
    fb_present = [f.ticket for f in (doc.feedback or []) if f.ticket]
    for r in tickets:
        if r.name in fb_present:
            continue
        if not (r.feedback_rating or (r.feedback_extra or "").strip() or r.feedback):
            continue
        text = (r.feedback_extra or "").strip()
        if r.feedback:
            text = (r.feedback + (": " + text if text else ""))
        doc.append("feedback", {
            "client_name": (r.client or "").strip(),
            "feedback": text,
            "rating": r.feedback_rating or 0,
            "ticket": r.name,
        })
        fb_present.append(r.name)
    if not (doc.feedback or []):
        doc.append("feedback", {})
        doc.append("feedback", {})

# ---------- file name base ----------
months = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
if doc.period_type == "Month":
    period_text = months[from_date.month - 1] + "_" + str(from_date.year)
else:
    period_text = frappe.utils.formatdate(from_date, "dd-MM-yyyy") + "_" + frappe.utils.formatdate(to_date, "dd-MM-yyyy")
doc.file_base = ((doc.engineer_name or doc.engineer) + "_work_report_" + period_text).replace(" ", "_")

doc.dismissed_suggestions = json.dumps(dismissed) if dismissed else None
