# Server Script — "Yool Engineer Report Generate All"
# Script Type: API | API Method: yool_engineer_report_generate_all | Allow Guest: off
# Args: from_date, to_date, period_type. Managers only. One report per active HD Agent who is a member
# of HD Team "Technical" (managed at /helpdesk/teams; empty/missing team -> all active agents) — created
# or, when still Draft, re-filled. Returns the list of report names.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))
if not is_manager:
    frappe.throw("Only an Agent Manager can generate reports for all agents.", title="Not permitted")

from_date = frappe.form_dict.get("from_date")
to_date = frappe.form_dict.get("to_date")
if not from_date or not to_date:
    frappe.throw("Please set From Date and To Date.", title="Period required")
from_date = frappe.utils.getdate(from_date)
to_date = frappe.utils.getdate(to_date)
period_type = frappe.form_dict.get("period_type") or "Month"
if period_type not in ("Month", "Week", "Custom"):
    period_type = "Custom"

tech_users = frappe.get_all(
    "HD Team Member",
    filters={"parenttype": "HD Team", "parent": "Technical"},
    pluck="user",
)
tech_users = [u for u in tech_users if u]
agent_filters = {"is_active": 1}
if tech_users:
    agent_filters["user"] = ["in", tech_users]

result = []
for a in frappe.get_all("HD Agent", filters=agent_filters, fields=["name", "user"], order_by="agent_name asc"):
    engineer = a.user or a.name
    name = frappe.db.get_value(
        "Engineer Monthly Report", {"engineer": engineer, "from_date": from_date, "to_date": to_date}, "name"
    )
    if name:
        doc = frappe.get_doc("Engineer Monthly Report", name)
        if doc.status == "Draft":
            doc.flags.yool_refresh = 1
            doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc({
            "doctype": "Engineer Monthly Report",
            "engineer": engineer,
            "period_type": period_type,
            "from_date": from_date,
            "to_date": to_date,
            "status": "Draft",
        })
        doc.flags.yool_refresh = 1
        doc.insert(ignore_permissions=True)
    result.append(doc.name)

frappe.response["message"] = result
