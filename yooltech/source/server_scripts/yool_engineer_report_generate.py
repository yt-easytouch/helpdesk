# Server Script — "Yool Engineer Report Generate"
# Script Type: API | API Method: yool_engineer_report_generate | Allow Guest: off
# Args: agent (HD Agent / user id), from_date, to_date, period_type (Month/Week/Custom, default Month).
# Finds the report for the same engineer + period or creates it, then fills it from the tickets
# (fill logic lives in Server Script "Engineer Monthly Report Validate", triggered by doc.flags.yool_refresh).
# A report that is no longer Draft is returned as it is (not re-filled). Returns the report name.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))

agent = (frappe.form_dict.get("agent") or "").strip() or user
engineer = frappe.db.get_value("HD Agent", agent, "user") or agent
if not frappe.db.exists("HD Agent", engineer):
    frappe.throw("Please choose a Helpdesk agent.", title="Agent required")
if not is_manager and engineer != user:
    frappe.throw("You can only generate your own Engineer Monthly Report.", title="Not permitted")

from_date = frappe.form_dict.get("from_date")
to_date = frappe.form_dict.get("to_date")
if not from_date or not to_date:
    frappe.throw("Please set From Date and To Date.", title="Period required")
from_date = frappe.utils.getdate(from_date)
to_date = frappe.utils.getdate(to_date)
period_type = frappe.form_dict.get("period_type") or "Month"
if period_type not in ("Month", "Week", "Custom"):
    period_type = "Custom"

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

frappe.response["message"] = doc.name
