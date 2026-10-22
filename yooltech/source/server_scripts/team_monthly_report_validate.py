# Server Script — "Team Monthly Report Validate"
# Script Type: DocType Event | Reference Doctype: Team Monthly Report | Event: Before Save
#
# 1. Managers only (Agent Manager / System Manager) — doctype permissions already hide it from Agents,
#    this guard also stops API writes.
# 2. Status flow (field status, no Workflow): Draft -> Submitted, Submitted -> Approved, Submitted -> Draft.
#    Approving stamps approved_by / approved_by_name with the session user. Approved reports are locked.
# 3. When doc.flags.yool_refresh is set (APIs yool_team_report_generate / yool_team_report_refresh) the
#    ticket/expense data is re-pulled: summary numbers and the computed tables (issue_rows, customer_rows,
#    engineer_rows, emr_links) are replaced. Typed text is NEVER erased: hordhac + the 4 nuxur_* fields are
#    only overwritten while they still equal their last generated copy (stored in nuxur_generated JSON);
#    challenges / feedback_rows are merged by source (source_emr / source) and honor dismissed_suggestions.
# 4. Ticket logic mirrors the Agent Ticket Report: tickets by opening_date in the period; the agent of a
#    ticket = first _assign entry else owner; resolved = status category 'Resolved' OR status Resolved/Closed
#    (Cancelled has category Resolved, so it counts as resolved — same as the Agent Report).
# 5. Expenses: GL account "5225 - Bajaaj Expense - YT" (posted only by Expense Bill), docstatus 1 implied by
#    GL, is_cancelled = 0, Expense Bill.expense_date in the period (falls back to posting_date).
#    linked (via Expense Bill.hd_ticket) + unlinked = total_expense, always.
# safe_exec: no imports, no tuple unpacking, no "d[k] += x", no _-prefixed attributes, no def helpers that
# need script-level names. Plain-text error messages (Helpdesk toasts show HTML literally).

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))
if not is_manager:
    frappe.throw("Only an Agent Manager or System Manager can work with the Team Monthly Report.", title="Not permitted")

if not doc.from_date or not doc.to_date:
    frappe.throw("Please set From Date and To Date.", title="Period required")
from_date = frappe.utils.getdate(doc.from_date)
to_date = frappe.utils.getdate(doc.to_date)
if from_date > to_date:
    frappe.throw("From Date cannot be after To Date.", title="Invalid period")
if not doc.period_type:
    doc.period_type = "Month"

MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
               "September", "October", "November", "December"]
doc.month_label = MONTHS_LONG[from_date.month - 1] + " " + str(from_date.year)
doc.file_base = "XAFIISKA_FARSAMADA_" + MONTHS_LONG[from_date.month - 1] + "_" + str(from_date.year) + "_REPORT"

if not doc.prepared_by:
    doc.prepared_by = user
doc.prepared_by_name = frappe.db.get_value("User", doc.prepared_by, "full_name") or doc.prepared_by

duplicate = frappe.db.sql(
    "SELECT name FROM `tabTeam Monthly Report` WHERE from_date = %(f)s AND to_date = %(t)s"
    " AND name != %(n)s LIMIT 1",
    {"f": from_date, "t": to_date, "n": doc.name or ""},
)
if duplicate:
    frappe.throw("A Team Monthly Report for this period already exists: " + duplicate[0][0] + ".", title="Duplicate report")

old = None
if not doc.is_new():
    old = doc.get_doc_before_save()

# ---------- status flow ----------
old_status = (old.status if old else "Draft") or "Draft"
new_status = doc.status or "Draft"
doc.status = new_status
if doc.is_new() and new_status != "Draft":
    frappe.throw("A new report must start as Draft.", title="Not permitted")
if old and old_status != new_status:
    allowed = False
    if old_status == "Draft" and new_status == "Submitted":
        allowed = True
    elif old_status == "Submitted" and new_status == "Approved":
        allowed = True
    elif old_status == "Submitted" and new_status == "Draft":
        allowed = True
    if not allowed:
        frappe.throw("Status cannot change from " + old_status + " to " + new_status + ".", title="Not permitted")
    if new_status == "Approved":
        doc.approved_by = user
        doc.approved_by_name = frappe.db.get_value("User", user, "full_name") or user
elif old and old_status == "Approved":
    frappe.throw("This report is Approved and locked. It can no longer be changed.", title="Not permitted")

# ---------- remember deleted suggestions (challenges by source_emr, feedback by source) ----------
dismissed = []
try:
    dismissed = json.loads(doc.dismissed_suggestions or "[]") or []
except Exception:
    dismissed = []
present_ch = [c.source_emr for c in (doc.challenges or []) if c.source_emr]
present_fb = [f.source for f in (doc.feedback_rows or []) if f.source]
if old:
    for c in (old.challenges or []):
        if c.suggested and c.source_emr and c.source_emr not in present_ch and ("ch:" + c.source_emr) not in dismissed:
            dismissed.append("ch:" + c.source_emr)
    for f0 in (old.feedback_rows or []):
        if f0.source and f0.source not in present_fb and ("fb:" + f0.source) not in dismissed:
            dismissed.append("fb:" + f0.source)

# ---------- re-pull the data (only when the API asks for it) ----------
if doc.flags.yool_refresh:
    rows = frappe.db.sql(
        "SELECT t.name, t.status, COALESCE(s.category, t.status_category) AS category,"
        " t.customer, COALESCE(cu.customer_name, t.erp_customer_name) AS client,"
        " t.ticket_type, t.opening_date, t.solved_by, t.raised_outside_working_hours AS overtime,"
        " t.chatwoot_conversation_id AS chat_id, t.source, t._assign AS assign_json, t.owner,"
        " t.feedback, t.feedback_rating, t.feedback_extra"
        " FROM `tabHD Ticket` t"
        " LEFT JOIN `tabHD Ticket Status` s ON s.name = t.status"
        " LEFT JOIN `tabCustomer` cu ON cu.name = t.customer"
        " WHERE t.opening_date BETWEEN %(f)s AND %(t)s"
        " ORDER BY t.opening_date ASC, t.creation ASC",
        {"f": from_date, "t": to_date},
        as_dict=True,
    )
    total = len(rows)

    # ----- Bajaaj expenses (GL 5225 via Expense Bill, expense_date in period) -----
    expenses = frappe.db.sql(
        "SELECT gle.voucher_type, gle.voucher_no, SUM(gle.debit - gle.credit) AS amount,"
        " eb.customer AS bill_customer, eb.hd_ticket"
        " FROM `tabGL Entry` gle"
        " LEFT JOIN `tabExpense Bill` eb ON gle.voucher_type = 'Expense Bill' AND eb.name = gle.voucher_no"
        " WHERE gle.account = %(acc)s AND gle.is_cancelled = 0"
        " AND COALESCE(eb.expense_date, gle.posting_date) BETWEEN %(f)s AND %(t)s"
        " GROUP BY gle.voucher_type, gle.voucher_no, eb.customer, eb.hd_ticket",
        {"acc": "5225 - Bajaaj Expense - YT", "f": from_date, "t": to_date},
        as_dict=True,
    )
    ticket_type_map = {}
    ticket_customer_map = {}
    for r in rows:
        ticket_type_map[r.name] = (r.ticket_type or "").strip() or "Unspecified"
        ticket_customer_map[r.name] = r.customer
    total_expense = 0
    linked_expense = 0
    unlinked_expense = 0
    expense_by_ticket = {}
    expense_by_type = {}
    expense_by_customer = {}
    for e in expenses:
        amount = frappe.utils.flt(e.amount, 2)
        if not amount:
            continue
        total_expense = total_expense + amount
        if e.hd_ticket:
            linked_expense = linked_expense + amount
            expense_by_ticket[e.hd_ticket] = expense_by_ticket.get(e.hd_ticket, 0) + amount
            ttype = ticket_type_map.get(e.hd_ticket)
            if not ttype:
                ttype = (frappe.db.get_value("HD Ticket", e.hd_ticket, "ticket_type") or "").strip() or "Unspecified"
            expense_by_type[ttype] = expense_by_type.get(ttype, 0) + amount
        else:
            unlinked_expense = unlinked_expense + amount
        cust = e.bill_customer
        if not cust and e.hd_ticket:
            cust = ticket_customer_map.get(e.hd_ticket) or frappe.db.get_value("HD Ticket", e.hd_ticket, "customer")
        ckey = cust or ""
        expense_by_customer[ckey] = expense_by_customer.get(ckey, 0) + amount

    # ----- buckets, per agent, per customer, per type (buckets are EXCLUSIVE, sum = total) -----
    fariin = 0
    booqasho = 0
    wicitaan = 0
    resolved = 0
    type_count = {}
    customer_tickets = {}
    customer_names = {}
    per_agent = {}
    visited = []
    period_customers = []
    for r in rows:
        users = []
        try:
            users = json.loads(r.assign_json or "[]") or []
        except Exception:
            users = []
        agent = users[0] if users else (r.owner or "")
        done = r.category == "Resolved" or r.status in ("Resolved", "Closed")
        if done:
            resolved = resolved + 1
        bucket = "wicitaan"
        if r.chat_id or r.source == "Chatwoot":
            bucket = "fariin"
            fariin = fariin + 1
        elif r.solved_by == "Visit" or expense_by_ticket.get(r.name):
            bucket = "booqasho"
            booqasho = booqasho + 1
        else:
            wicitaan = wicitaan + 1
        ttype = ticket_type_map.get(r.name) or "Unspecified"
        type_count[ttype] = type_count.get(ttype, 0) + 1
        ckey = r.customer or ""
        customer_tickets[ckey] = customer_tickets.get(ckey, 0) + 1
        if ckey and ckey not in customer_names:
            customer_names[ckey] = (r.client or "").strip() or ckey
        if ckey and ckey not in period_customers:
            period_customers.append(ckey)
        if bucket == "booqasho" and ckey and ckey not in visited:
            visited.append(ckey)
        a = per_agent.get(agent)
        if a is None:
            a = {"count": 0, "overtime": 0, "online": 0}
            per_agent[agent] = a
        a["count"] = a["count"] + 1
        if r.overtime:
            a["overtime"] = a["overtime"] + 1
        if bucket != "booqasho":
            a["online"] = a["online"] + 1

    new_clients = 0
    if period_customers:
        firsts = frappe.db.sql(
            "SELECT customer, MIN(opening_date) AS first_date FROM `tabHD Ticket`"
            " WHERE customer IN %(c)s GROUP BY customer",
            {"c": tuple(period_customers)},
            as_dict=True,
        )
        for x in firsts:
            if x.first_date and from_date <= frappe.utils.getdate(x.first_date) <= to_date:
                new_clients = new_clients + 1

    # ----- summary numbers -----
    doc.total_issues = total
    doc.resolved_count = resolved
    doc.unresolved_count = total - resolved
    doc.issues_resolved_count = resolved
    doc.fariin_count = fariin
    doc.wicitaan_count = wicitaan
    doc.booqasho_count = booqasho
    doc.new_clients_count = new_clients
    doc.clients_visited_count = len(visited)
    doc.total_expense = frappe.utils.flt(total_expense, 2)
    doc.linked_expense = frappe.utils.flt(linked_expense, 2)
    doc.unlinked_expense = frappe.utils.flt(unlinked_expense, 2)
    doc.avg_expense_per_issue = frappe.utils.flt(total_expense / total, 2) if total else 0

    # ----- issue_rows (sorted by count desc; "Lama xirin ticket" row carries the unlinked expense) -----
    items = []
    for k in type_count:
        items.append({"issue_type": k, "ticket_count": type_count[k],
                      "expense": frappe.utils.flt(expense_by_type.get(k, 0), 2)})
    for k in expense_by_type:
        if k not in type_count:
            items.append({"issue_type": k, "ticket_count": 0,
                          "expense": frappe.utils.flt(expense_by_type[k], 2)})
    items = sorted(items, key=lambda x: [-x["ticket_count"], str(x["issue_type"]).lower()])
    for it in items:
        it["pct"] = (str(frappe.utils.flt(it["ticket_count"] * 100.0 / total, 1)) + "%") if total else "0%"
    if unlinked_expense:
        items.append({"issue_type": "Lama xirin ticket", "ticket_count": 0, "pct": "—",
                      "expense": frappe.utils.flt(unlinked_expense, 2)})
    doc.set("issue_rows", items)

    # ----- customer_rows (alphabetical by name; ticket % of total tickets, expense % of total expense) -----
    ckeys = []
    for k in customer_tickets:
        if k not in ckeys:
            ckeys.append(k)
    for k in expense_by_customer:
        if k not in ckeys:
            ckeys.append(k)
    crows = []
    for k in ckeys:
        cname = customer_names.get(k) or (frappe.db.get_value("Customer", k, "customer_name") if k else "") or k or "Aan la cayimin"
        tc = customer_tickets.get(k, 0)
        ex = frappe.utils.flt(expense_by_customer.get(k, 0), 2)
        if not tc and not ex:
            continue
        crows.append({
            "customer": k, "customer_name": cname, "ticket_count": tc,
            "ticket_pct": (str(frappe.utils.flt(tc * 100.0 / total, 2)) + "%") if total else "0%",
            "expense": ex,
            "expense_pct": (str(frappe.utils.flt(ex * 100.0 / total_expense, 2)) + "%") if total_expense else "0%",
        })
    crows = sorted(crows, key=lambda x: str(x["customer_name"]).lower())
    doc.set("customer_rows", crows)

    # ----- engineer_rows (HD Team "Technical" members incl. zeros; every other ticket owner is
    # folded into one "Kale (aan farsamo ahayn)" row so column sums still equal the totals —
    # same pattern as the customer table's "Aan la cayimin". Team managed at /helpdesk/teams;
    # empty/missing team falls back to all active HD Agents.) -----
    member_users = frappe.get_all(
        "HD Team Member",
        filters={"parenttype": "HD Team", "parent": "Technical"},
        pluck="user",
    )
    member_users = [u for u in member_users if u]
    if not member_users:
        for a in frappe.db.sql("SELECT name, user FROM `tabHD Agent` WHERE is_active = 1", as_dict=True):
            member_users.append(a.user or a.name)
    arows = []
    seen_users = []
    for u in member_users:
        if u in seen_users:
            continue
        st = per_agent.get(u) or {"count": 0, "overtime": 0, "online": 0}
        nm = (frappe.db.get_value("HD Agent", {"user": u}, "agent_name")
              or frappe.db.get_value("User", u, "full_name") or u)
        arows.append({"engineer_name": nm, "ticket_count": st["count"], "overtime_count": st["overtime"],
                      "online_count": st["online"],
                      "pct": (str(frappe.utils.flt(st["count"] * 100.0 / total, 1)) + "%") if total else "0%"})
        seen_users.append(u)
    other = {"count": 0, "overtime": 0, "online": 0}
    for u in per_agent:
        if u in seen_users:
            continue
        st = per_agent[u]
        other["count"] = other["count"] + st["count"]
        other["overtime"] = other["overtime"] + st["overtime"]
        other["online"] = other["online"] + st["online"]
    arows = sorted(arows, key=lambda x: [-x["ticket_count"], str(x["engineer_name"]).lower()])
    if other["count"]:
        arows.append({"engineer_name": "Kale (aan farsamo ahayn)", "ticket_count": other["count"],
                      "overtime_count": other["overtime"], "online_count": other["online"],
                      "pct": (str(frappe.utils.flt(other["count"] * 100.0 / total, 1)) + "%") if total else "0%"})
    doc.set("engineer_rows", arows)

    # ----- Engineer Monthly Reports of the period (overlap) -----
    emrs = frappe.db.sql(
        "SELECT name, engineer, engineer_name, status FROM `tabEngineer Monthly Report`"
        " WHERE from_date <= %(t)s AND to_date >= %(f)s ORDER BY engineer_name ASC",
        {"f": from_date, "t": to_date},
        as_dict=True,
    )
    doc.set("emr_links", [])
    for m in emrs:
        doc.append("emr_links", {"emr": m.name, "engineer_name": m.engineer_name or m.engineer, "emr_status": m.status or ""})

    # ----- challenges from the period's EMRs (merge by source_emr, honor dismissed) -----
    for m in emrs:
        if m.name in present_ch or ("ch:" + m.name) in dismissed:
            continue
        ch_rows = frappe.db.sql(
            "SELECT challenge, solution FROM `tabEngineer Report Challenge`"
            " WHERE parent = %(p)s AND parenttype = 'Engineer Monthly Report' ORDER BY idx ASC",
            {"p": m.name},
            as_dict=True,
        )
        added = 0
        for c in ch_rows:
            if not (c.challenge or "").strip():
                continue
            doc.append("challenges", {
                "challenge": c.challenge, "solution": c.solution or "",
                "engineer_name": m.engineer_name or m.engineer, "suggested": 1, "source_emr": m.name,
            })
            added = added + 1
        if added:
            present_ch.append(m.name)

    # ----- feedback: EMR feedback rows + HD Ticket feedback (merge by source, honor dismissed) -----
    for m in emrs:
        if m.name in present_fb or ("fb:" + m.name) in dismissed:
            continue
        fb_rows = frappe.db.sql(
            "SELECT client_name, feedback, rating FROM `tabEngineer Report Feedback`"
            " WHERE parent = %(p)s AND parenttype = 'Engineer Monthly Report' ORDER BY idx ASC",
            {"p": m.name},
            as_dict=True,
        )
        added = 0
        for x in fb_rows:
            if not ((x.feedback or "").strip() or x.rating):
                continue
            doc.append("feedback_rows", {"client_name": x.client_name or "", "feedback": x.feedback or "",
                                         "rating": x.rating or 0, "source": m.name})
            added = added + 1
        if added:
            present_fb.append(m.name)
    for r in rows:
        if r.name in present_fb or ("fb:" + r.name) in dismissed:
            continue
        if not (r.feedback_rating or (r.feedback_extra or "").strip() or r.feedback):
            continue
        text = (r.feedback_extra or "").strip()
        if r.feedback:
            text = r.feedback + (": " + text if text else "")
        doc.append("feedback_rows", {"client_name": (r.client or "").strip(), "feedback": text,
                                     "rating": r.feedback_rating or 0, "source": r.name})
        present_fb.append(r.name)

    # ----- Somali auto-sentences (only overwrite fields still equal to their last generated copy) -----
    top_type = ""
    top_type_count = 0
    distinct_types = 0
    for it in items:
        if it["issue_type"] == "Lama xirin ticket":
            continue
        if it["ticket_count"] > 0:
            distinct_types = distinct_types + 1
        if it["ticket_count"] > top_type_count:
            top_type_count = it["ticket_count"]
            top_type = it["issue_type"]
    named_customers = len([k for k in customer_tickets if k])
    max_cust_tickets = 0
    max_cust_name = ""
    for k in customer_tickets:
        if k and customer_tickets[k] > max_cust_tickets:
            max_cust_tickets = customer_tickets[k]
            max_cust_name = customer_names.get(k) or k
    top_eng = ""
    top_eng_pct = "0"
    if arows and arows[0]["ticket_count"]:
        top_eng = arows[0]["engineer_name"]
        top_eng_pct = str(frappe.utils.flt(arows[0]["ticket_count"] * 100.0 / total, 2)) if total else "0"
    amt = frappe.utils.flt(total_expense, 2)
    amt_text = str(int(amt)) if amt == int(amt) else str(amt)

    gen = {}
    gen["hordhac"] = (
        "<p>Waxaa farxad inoo ah in aan halkan idinkugu soo gudbino warbixinta bilaha ah ee xafiiska "
        "farsamada ee Yooltech. Warxibin tani waxa ay dulmar dhameystiran ka bixineysaa wax qabadka "
        "waaxda Farsamada iyo shaqooyinka ay qabteen bishan.</p>"
        "<p>Waxaa warbixintan ku jira qeybo faahfaahsan oo ku saabsan macaamiisha loo adeegay, ciladaha "
        "laxaliyay iyo nuucooda, waxqabadka injineerada, iyo qarashaadka ku baxay shaqooyinka waaxda, "
        "Waxeyna u diyaarsan yihiin si ay sawir guud uga bixiyaan waaxda iyo waxqabadkeeda.</p>"
    )
    gen["nuxur_cilado"] = (
        "Reportkan waa mid dhameystiran oo ku saabsan bisha " + str(from_date.month) + " aad ee sanadka "
        + str(from_date.year) + ". Waxaan la xalinay " + str(resolved) + " ciladood oo inoo yimid oo isugu jira "
        + str(distinct_types) + " nuuc oo ciladood, waxaana ugu badnaa nuuca '" + top_type + "' oo gaaray "
        + str(top_type_count) + " mar."
    )
    gen["nuxur_macaamiil"] = (
        "Waxaan u adeegnay " + str(named_customers) + " macmiil, macmiilka ugu badnaa bishan ("
        + max_cust_name + ") waxaa cilad looga xaliyay " + str(max_cust_tickets) + " jeer."
    )
    gen["nuxur_injineer"] = (
        "Teamka bishan waxaa caawinaada ugu badan sameeyay " + top_eng + " oo xaliyay "
        + top_eng_pct + "% ciladaha teamka bishan."
    )
    gen["nuxur_kharash"] = (
        "Bishan waxaa kharashaad (Bajaaj) inaga baxay lacag dhan $" + amt_text + "."
    )
    prev = {}
    try:
        prev = json.loads(doc.nuxur_generated or "{}") or {}
    except Exception:
        prev = {}
    for f in gen:
        cur = doc.get(f) or ""
        if (not str(cur).strip()) or str(cur) == str(prev.get(f) or ""):
            doc.set(f, gen[f])
    doc.nuxur_generated = json.dumps(gen)
    doc.last_refreshed = frappe.utils.now_datetime()

# ---------- row indexes ----------
position = 0
for a in (doc.issue_rows or []):
    position = position + 1
    a.idx = position
position = 0
for a in (doc.customer_rows or []):
    position = position + 1
    a.idx = position
position = 0
for a in (doc.engineer_rows or []):
    position = position + 1
    a.idx = position

doc.dismissed_suggestions = json.dumps(dismissed) if dismissed else None
