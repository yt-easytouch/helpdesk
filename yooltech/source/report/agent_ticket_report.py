# Agent Ticket Report — non-standard Script Report (Report doctype, field "report_script").
# Runs inside Frappe safe_exec: no imports; `filters`, `frappe`, `json` are provided.
# Script-level names are not visible inside `def` functions, so helpers take them as args.
# Read-only: SELECT queries only, all user input passed as SQL parameters.
#
# Agent empty  -> all tickets in the range (every agent, plus unassigned ones). Totals stay ALL
#                 tickets, but per-agent views cover only HD Team "Technical" members (managed at
#                 /helpdesk/teams; empty/missing team falls back to all active HD Agents).
# Agent chosen -> only tickets whose _assign JSON contains that user; a comma-separated
#                 list selects several agents at once (a ticket matches any of them).
# View "Summary per Agent" -> one row per agent instead of one row per ticket.
# View "Bajaaj Expense by Company" -> GL account 5225 per customer (exportable, with totals).
#
# Bajaaj expenses: GL Entry on BAJAAJ_ACCOUNT by posting_date within From/To. The customer comes from
# Expense Bill.customer (or the GL party when it is a Customer), the agent from Expense Bill.employee
# -> Employee.user_id, the ticket from Expense Bill.hd_ticket. Only users with read access to GL Entry
# get any expense numbers.

ALLOWED_ROLES = ["Agent Manager", "System Manager", "Administrator"]
user_roles = [r[0] for r in frappe.db.sql(
    "SELECT role FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(user)s",
    {"user": frappe.session.user},
)]
if frappe.session.user != "Administrator" and not [r for r in user_roles if r in ALLOWED_ROLES]:
    frappe.throw("Only Agent Manager / System Manager can run this report.")

agent = filters.get("agent")
from_date = filters.get("from_date") or frappe.utils.get_first_day(frappe.utils.nowdate())
to_date = filters.get("to_date") or frappe.utils.nowdate()
based_on = filters.get("based_on") or "Opening Date"
view = filters.get("view") or "Tickets"

from_date = frappe.utils.getdate(from_date)
to_date = frappe.utils.getdate(to_date)
if from_date > to_date:
    frappe.throw("From Date cannot be after To Date.")

# One value or a comma-separated list; each entry resolves HD Agent -> user id.
agent_users = []
for part in (str(agent).split(",") if agent else []):
    part = part.strip()
    if part:
        mapped = frappe.db.get_value("HD Agent", part, "user") or part
        if mapped not in agent_users:
            agent_users.append(mapped)

# Technical team members: the only agents this report breaks down by. Managed in HD Team
# "Technical" (Helpdesk admin UI /helpdesk/teams). Empty/missing team -> all active agents.
tech_users = [r[0] for r in frappe.db.sql(
    "SELECT user FROM `tabHD Team Member`"
    " WHERE parenttype = 'HD Team' AND parent = 'Technical' AND COALESCE(user, '') != ''"
)]
if not tech_users:
    tech_users = [r[0] for r in frappe.db.sql(
        "SELECT COALESCE(user, name) FROM `tabHD Agent` WHERE is_active = 1"
    )]
non_tech = [u for u in agent_users if u not in tech_users]
if non_tech:
    frappe.throw(
        "Only Technical team members can be selected as Agent: " + ", ".join(non_tech)
        + ". Manage members in HD Team 'Technical' (Helpdesk > Teams)."
    )

# Column for the date filter comes from a fixed whitelist, never from user input.
if based_on == "Resolution Date":
    date_expr = "DATE(t.resolution_date)"
else:
    based_on = "Opening Date"
    date_expr = "t.opening_date"

values = {"from_date": from_date, "to_date": to_date}
conditions = [date_expr + " BETWEEN %(from_date)s AND %(to_date)s"]
if agent_users:
    # Exact quoted match inside the _assign JSON, with LIKE wildcards escaped; any selected agent matches.
    like_parts = []
    i = 0
    for au in agent_users:
        escaped = au.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        key = "assign_pat_" + str(i)
        values[key] = '%"' + escaped + '"%'
        like_parts.append("t._assign LIKE %(" + key + ")s")
        i = i + 1
    conditions.append("(" + " OR ".join(like_parts) + ")")
if filters.get("status"):
    conditions.append("t.status = %(status)s")
    values["status"] = filters.get("status")
if filters.get("customer"):
    conditions.append("t.customer = %(customer)s")
    values["customer"] = filters.get("customer")
if filters.get("status_category"):
    conditions.append("COALESCE(s.category, t.status_category) = %(status_category)s")
    values["status_category"] = filters.get("status_category")
if filters.get("source_team"):
    # Ka yimid / Raised by team (HD Ticket.source_team: Sales / Technical).
    conditions.append("t.source_team = %(source_team)s")
    values["source_team"] = filters.get("source_team")

rows = frappe.db.sql(
    "SELECT t.name, t.subject, t.status, COALESCE(s.category, t.status_category) AS category,"
    " t.priority, t.customer, COALESCE(t.erp_customer_name, cu.customer_name) AS company,"
    " COALESCE(t.primary_contact_name, pc.full_name) AS primary_contact,"
    " t.contact, t.raised_by, t.caller_name, t.caller_phone, t.ticket_type, t.source_team,"
    " t.opening_date, t.opening_time, t.first_responded_on, t.resolution_date,"
    " t.first_response_time, t.resolution_time, t.agreement_status, t._assign AS assign_json,"
    " " + date_expr + " AS bucket_date"
    " FROM `tabHD Ticket` t"
    " LEFT JOIN `tabHD Ticket Status` s ON s.name = t.status"
    " LEFT JOIN `tabCustomer` cu ON cu.name = t.customer"
    " LEFT JOIN `tabContact` pc ON pc.name = cu.customer_primary_contact"
    " WHERE " + " AND ".join(conditions) +
    " ORDER BY t.opening_date DESC, t.creation DESC",
    values,
    as_dict=True,
)

# user id -> display name (HD Agent name, else User full name, else the id).
agent_names = {}
for a in frappe.db.sql("SELECT name, agent_name FROM `tabHD Agent`", as_dict=True):
    agent_names[a.name] = a.agent_name or a.name


def assignees(assign_json):
    try:
        users = json.loads(assign_json or "[]") or []
    except Exception:
        users = []
    return [u for u in users if u]


def display_name(user, names):
    if user not in names:
        names[user] = frappe.db.get_value("User", user, "full_name") or user
    return names[user]


def to_hours(seconds, start, end):
    # Prefer the stored Duration (seconds); fall back to the timestamp difference.
    if seconds:
        return frappe.utils.flt(seconds / 3600.0, 2)
    if start and end:
        diff = frappe.utils.time_diff_in_seconds(end, start)
        if diff >= 0:
            return frappe.utils.flt(diff / 3600.0, 2)
    return None


def stats(items):
    total = len(items)
    resolved = len([d for d in items if d["category"] == "Resolved" or d["status"] in ("Resolved", "Closed")])
    failed = len([d for d in items if d["agreement_status"] == "Failed"])
    fulfilled = len([d for d in items if d["agreement_status"] == "Fulfilled"])
    frt = [d["first_response_hours"] for d in items if d["first_response_hours"] is not None]
    rt = [d["resolution_hours"] for d in items if d["resolution_hours"] is not None]
    return {
        "total": total,
        "resolved": resolved,
        "open": total - resolved,
        "sla_failed": failed,
        "sla_pct": frappe.utils.flt(fulfilled * 100.0 / (fulfilled + failed), 1) if (fulfilled + failed) else 0,
        "avg_frt": frappe.utils.flt(sum(frt) / len(frt), 2) if frt else 0,
        "avg_rt": frappe.utils.flt(sum(rt) / len(rt), 2) if rt else 0,
    }


tickets = []
per_day = {}
per_agent = {}  # user id ("" = unassigned) -> list of ticket rows
for r in rows:
    users = assignees(r.assign_json)
    if agent_users and not [u for u in users if u in agent_users]:
        continue
    opened_at = None
    if r.opening_date:
        opened_at = frappe.utils.get_datetime(str(r.opening_date) + " " + str(r.opening_time or "00:00:00"))
    row = {
        "name": r.name,
        "subject": r.subject,
        "status": r.status,
        "category": r.category,
        "assigned_to": ", ".join([display_name(u, agent_names) for u in users]) or "Unassigned",
        "priority": r.priority,
        "customer": r.customer,
        "company": r.company,
        "primary_contact": r.primary_contact,
        "contact": r.contact or r.raised_by,
        "caller_name": r.caller_name,
        "caller_phone": r.caller_phone,
        "ticket_type": r.ticket_type,
        "source_team": r.source_team,
        "opening_date": r.opening_date,
        "first_responded_on": r.first_responded_on,
        "resolution_date": r.resolution_date,
        "first_response_hours": to_hours(r.first_response_time, opened_at, r.first_responded_on),
        "resolution_hours": to_hours(r.resolution_time, opened_at, r.resolution_date) if r.resolution_date else None,
        "agreement_status": r.agreement_status,
    }
    tickets.append(row)
    key = str(r.bucket_date)
    per_day[key] = per_day.get(key, 0) + 1
    # A ticket with two assignees counts for both agents. Per-agent sections cover only
    # Technical team members (the overall totals above still count every ticket).
    for u in users:
        if agent_users and u not in agent_users:
            continue
        if u not in tech_users:
            continue
        per_agent.setdefault(u, []).append(row)

# ---------- Bajaaj expenses (GL account 5225) ----------
BAJAAJ_ACCOUNT = "5225 - Bajaaj Expense - YT"

# Read access to GL Entry: Custom DocPerm replaces the standard DocPerm when it exists.
can_see_expense = frappe.session.user == "Administrator"
if not can_see_expense and user_roles:
    perm_table = "tabCustom DocPerm" if frappe.db.sql(
        "SELECT COUNT(*) FROM `tabCustom DocPerm` WHERE parent = 'GL Entry'"
    )[0][0] else "tabDocPerm"
    can_see_expense = bool(frappe.db.sql(
        "SELECT 1 FROM `" + perm_table + "` WHERE parent = 'GL Entry' AND permlevel = 0 AND `read` = 1"
        " AND role IN %(roles)s LIMIT 1",
        {"roles": tuple(user_roles)},
    ))

if view == "Bajaaj Expense by Company" and not can_see_expense:
    frappe.throw("You need read access to GL Entry to see Bajaaj expenses.")

expense_total = 0
expense_currency = None
expense_by_ticket = {}
expense_by_customer = {}
unlinked = []
if can_see_expense:
    expense_currency = frappe.db.get_value(
        "Company", frappe.db.get_value("Account", BAJAAJ_ACCOUNT, "company"), "default_currency"
    )
    customer_expr = "COALESCE(eb.customer, IF(gle.party_type = 'Customer', gle.party, NULL))"
    e_values = {"account": BAJAAJ_ACCOUNT, "from_date": from_date, "to_date": to_date}
    # account + posting_date are both indexed on GL Entry.
    e_conditions = [
        "gle.account = %(account)s",
        "gle.posting_date BETWEEN %(from_date)s AND %(to_date)s",
        "gle.is_cancelled = 0",
    ]
    if filters.get("customer"):
        e_conditions.append(customer_expr + " = %(customer)s")
        e_values["customer"] = filters.get("customer")
    if agent_users:
        # Agent filter only matches expenses that record the agent (Employee.user_id).
        e_conditions.append("emp.user_id IN %(agent_users)s")
        e_values["agent_users"] = tuple(agent_users)
    expenses = frappe.db.sql(
        "SELECT gle.voucher_type, gle.voucher_no, SUM(gle.debit - gle.credit) AS amount,"
        " " + customer_expr + " AS expense_customer, cu.customer_name, eb.hd_ticket"
        " FROM `tabGL Entry` gle"
        " LEFT JOIN `tabExpense Bill` eb ON gle.voucher_type = 'Expense Bill' AND eb.name = gle.voucher_no"
        " LEFT JOIN `tabEmployee` emp ON emp.name = eb.employee"
        " LEFT JOIN `tabCustomer` cu ON cu.name = " + customer_expr +
        " WHERE " + " AND ".join(e_conditions) +
        " GROUP BY gle.voucher_type, gle.voucher_no, expense_customer, cu.customer_name, eb.hd_ticket",
        e_values,
        as_dict=True,
    )
    for e in expenses:
        amount = frappe.utils.flt(e.amount, 2)
        expense_total += amount
        if e.hd_ticket:
            expense_by_ticket[e.hd_ticket] = expense_by_ticket.get(e.hd_ticket, 0) + amount
        if e.expense_customer:
            bucket = expense_by_customer.setdefault(
                e.expense_customer,
                {"customer": e.expense_customer, "company": e.customer_name or e.expense_customer, "entries": 0, "amount": 0, "ticket_linked": 0},
            )
            # RestrictedPython rejects "+=" on dict items.
            bucket["entries"] = bucket["entries"] + 1
            bucket["amount"] = bucket["amount"] + amount
            if e.hd_ticket:
                bucket["ticket_linked"] = bucket["ticket_linked"] + amount
        else:
            unlinked.append({"doctype": e.voucher_type, "name": e.voucher_no, "amount": amount})
    expense_total = frappe.utils.flt(expense_total, 2)

    tickets_per_customer = {}
    for t in tickets:
        if t["customer"]:
            tickets_per_customer[t["customer"]] = tickets_per_customer.get(t["customer"], 0) + 1
    # Per ticket: the amount linked to it via Expense Bill.hd_ticket, plus an equal share of the company's
    # expenses that name no ticket (company total / its tickets in the period), so a company's tickets add
    # up to its total. The share is labelled as an average in the report.
    for t in tickets:
        t["bajaaj_expense"] = expense_by_ticket.get(t["name"])
        t["bajaaj_share"] = None
        b = expense_by_customer.get(t["customer"]) if t["customer"] else None
        n = tickets_per_customer.get(t["customer"], 0) if t["customer"] else 0
        if b and n and b["amount"] - b["ticket_linked"] > 0:
            t["bajaaj_share"] = frappe.utils.flt((b["amount"] - b["ticket_linked"]) / n, 2)
        t["currency"] = expense_currency

expense_rows = []
for c in expense_by_customer:
    b = expense_by_customer[c]
    n = tickets_per_customer.get(c, 0)
    expense_rows.append({
        "customer": b["customer"],
        "company": b["company"],
        "entries": b["entries"],
        "amount": frappe.utils.flt(b["amount"], 2),
        "tickets": n,
        "per_ticket": frappe.utils.flt(b["amount"] / n, 2) if n else None,
        "currency": expense_currency,
    })
expense_rows = sorted(expense_rows, key=lambda x: (-x["amount"], x["company"]))
unlinked_total = frappe.utils.flt(sum([u["amount"] for u in unlinked]), 2)

overall = stats(tickets)
report_summary = [
    {"value": overall["total"], "label": "Total Tickets", "datatype": "Int", "indicator": "Blue"},
    {"value": overall["resolved"], "label": "Resolved / Closed", "datatype": "Int", "indicator": "Green"},
    {"value": overall["open"], "label": "Still Open", "datatype": "Int", "indicator": "Orange"},
    {"value": overall["sla_failed"], "label": "SLA Failed", "datatype": "Int", "indicator": "Red"},
    {"value": overall["sla_pct"], "label": "SLA Fulfilled %", "datatype": "Percent", "indicator": "Green"},
    {"value": overall["avg_frt"], "label": "Avg First Response (hrs)", "datatype": "Float", "indicator": "Blue"},
    {"value": overall["avg_rt"], "label": "Avg Resolution (hrs)", "datatype": "Float", "indicator": "Blue"},
]
if can_see_expense:
    report_summary.append(
        {"value": expense_total, "label": "Bajaaj Expense", "datatype": "Currency", "currency": expense_currency, "indicator": "Orange"}
    )

# The page's own section ("Bajaaj expense by company" + unlinked line) is drawn by the report JS from this
# payload; it travels as HTML-escaped JSON in the report message, which the JS hides.
expense_message = None
if can_see_expense and view != "Bajaaj Expense by Company":
    payload = json.dumps({
        "currency": expense_currency,
        "total": expense_total,
        "rows": expense_rows,
        "unlinked": {"count": len(unlinked), "total": unlinked_total, "vouchers": unlinked[:200]},
    }, default=str)
    payload = payload.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    expense_message = '<div class="atr-baj-data" hidden>' + payload + "</div>"

if view == "Bajaaj Expense by Company":
    columns = [
        {"fieldname": "company", "label": "Company", "fieldtype": "Data", "width": 240},
        {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer", "width": 160},
        {"fieldname": "entries", "label": "Expense Entries", "fieldtype": "Int", "width": 130},
        {"fieldname": "amount", "label": "Total Bajaaj Expense", "fieldtype": "Currency", "options": "currency", "width": 170},
        {"fieldname": "tickets", "label": "Tickets in Period", "fieldtype": "Int", "width": 130},
        {"fieldname": "per_ticket", "label": "Expense per Ticket", "fieldtype": "Currency", "options": "currency", "width": 160},
        {"fieldname": "currency", "label": "Currency", "fieldtype": "Link", "options": "Currency", "width": 80, "hidden": 1},
    ]
    result = list(expense_rows)
    if unlinked:
        result.append({
            "company": "Unlinked expenses", "entries": len(unlinked), "amount": unlinked_total,
            "currency": expense_currency, "is_unlinked": 1,
        })
    linked_tickets = sum([r["tickets"] for r in expense_rows])
    result.append({
        "company": "Total",
        "entries": sum([r["entries"] for r in expense_rows]) + len(unlinked),
        "amount": expense_total,
        "tickets": linked_tickets,
        "currency": expense_currency,
        "is_total": 1,
    })
    top = expense_rows[:15]
    chart = {
        "data": {"labels": [r["company"] for r in top], "datasets": [{"name": "Bajaaj Expense", "values": [r["amount"] for r in top]}]},
        "title": "Bajaaj expense by company",
        "type": "bar",
        "colors": ["#1db487"],
    }
    data = (columns, result, None, chart, report_summary)
elif view == "Summary per Agent":
    summary_rows = []
    for u in per_agent:
        s = stats(per_agent[u])
        s["agent_user"] = u
        s["agent"] = display_name(u, agent_names) if u else "Unassigned"
        summary_rows.append(s)
    summary_rows = sorted(summary_rows, key=lambda x: (-x["total"], x["agent"]))

    columns = [
        {"fieldname": "agent", "label": "Agent", "fieldtype": "Data", "width": 200},
        {"fieldname": "agent_user", "label": "Agent ID", "fieldtype": "Data", "width": 200, "hidden": 1},
        {"fieldname": "total", "label": "Total", "fieldtype": "Int", "width": 90},
        {"fieldname": "resolved", "label": "Resolved / Closed", "fieldtype": "Int", "width": 130},
        {"fieldname": "open", "label": "Open", "fieldtype": "Int", "width": 90},
        {"fieldname": "sla_failed", "label": "SLA Failed", "fieldtype": "Int", "width": 100},
        {"fieldname": "sla_pct", "label": "SLA %", "fieldtype": "Percent", "width": 90},
        {"fieldname": "avg_frt", "label": "Avg First Response (hrs)", "fieldtype": "Float", "precision": 2, "width": 170},
        {"fieldname": "avg_rt", "label": "Avg Resolution (hrs)", "fieldtype": "Float", "precision": 2, "width": 160},
    ]
    chart = {
        "data": {
            "labels": [s["agent"] for s in summary_rows],
            "datasets": [
                {"name": "Total", "values": [s["total"] for s in summary_rows]},
                {"name": "Resolved / Closed", "values": [s["resolved"] for s in summary_rows]},
            ],
        },
        "title": "Tickets per agent",
        "type": "bar",
        # Figma Chart: grey (bg-gray-secondary 100) next to brand (bg-brand-bold 600).
        "colors": ["#dadadb", "#1db487"],
    }
    data = (columns, summary_rows, expense_message, chart, report_summary)
else:
    columns = [
        # Shown columns: the report JS draws each as two lines (main value + detail from the hidden fields
        # noted after it), so every field stays visible without horizontal scrolling.
        {"fieldname": "name", "label": "Ticket", "fieldtype": "Link", "options": "HD Ticket", "width": 100},  # + opening date
        {"fieldname": "subject", "label": "Subject", "fieldtype": "Data", "width": 240},  # + ticket type, priority
        {"fieldname": "status", "label": "Status / SLA", "fieldtype": "Link", "options": "HD Ticket Status", "width": 130},  # + SLA
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data", "width": 150},
        {"fieldname": "source_team", "label": "Ka yimid", "fieldtype": "Data", "width": 100},
        {"fieldname": "company", "label": "Company", "fieldtype": "Data", "width": 190},  # + customer ID
        {"fieldname": "primary_contact", "label": "Contact", "fieldtype": "Data", "width": 170},  # + contact record
        {"fieldname": "caller_name", "label": "Caller", "fieldtype": "Data", "width": 140},  # + caller phone
        {"fieldname": "first_response_hours", "label": "Response / Resolution", "fieldtype": "Float", "precision": 2, "width": 170},
        # Hidden here but still in the data and in exports (report JS sets export_hidden_cols).
        {"fieldname": "priority", "label": "Priority", "fieldtype": "Link", "options": "HD Ticket Priority", "width": 90, "hidden": 1},
        {"fieldname": "customer", "label": "Customer", "fieldtype": "Link", "options": "Customer", "width": 160, "hidden": 1},
        {"fieldname": "contact", "label": "Contact Record", "fieldtype": "Data", "width": 160, "hidden": 1},
        {"fieldname": "caller_phone", "label": "Caller Phone", "fieldtype": "Data", "width": 130, "hidden": 1},
        {"fieldname": "ticket_type", "label": "Ticket Type", "fieldtype": "Link", "options": "HD Ticket Type", "width": 120, "hidden": 1},
        {"fieldname": "opening_date", "label": "Opening Date", "fieldtype": "Date", "width": 105, "hidden": 1},
        {"fieldname": "first_responded_on", "label": "First Responded On", "fieldtype": "Datetime", "width": 160, "hidden": 1},
        {"fieldname": "resolution_date", "label": "Resolution Date", "fieldtype": "Datetime", "width": 160, "hidden": 1},
        {"fieldname": "resolution_hours", "label": "Resolution Time (hrs)", "fieldtype": "Float", "precision": 2, "width": 120, "hidden": 1},
        {"fieldname": "agreement_status", "label": "SLA Status", "fieldtype": "Data", "width": 140, "hidden": 1},
    ]
    if can_see_expense:
        columns.append({"fieldname": "bajaaj_expense", "label": "Bajaaj", "fieldtype": "Currency", "options": "currency", "width": 120})  # + company avg share
        columns.append({"fieldname": "bajaaj_share", "label": "Bajaaj (company avg share)", "fieldtype": "Currency", "options": "currency", "width": 120, "hidden": 1})
        columns.append({"fieldname": "currency", "label": "Currency", "fieldtype": "Link", "options": "Currency", "width": 80, "hidden": 1})
    labels = []
    counts = []
    day = from_date
    while day <= to_date:
        labels.append(frappe.utils.formatdate(day, "dd-MM"))
        counts.append(per_day.get(str(day), 0))
        day = frappe.utils.add_days(day, 1)
    chart = {
        "data": {"labels": labels, "datasets": [{"name": "Tickets (" + based_on + ")", "values": counts}]},
        "title": "Tickets per day",
        "type": "bar",
        # Figma Chart: bg-brand-bold (600).
        "colors": ["#1db487"],
    }
    data = (columns, tickets, expense_message, chart, report_summary)
