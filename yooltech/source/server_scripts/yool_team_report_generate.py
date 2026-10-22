# Server Script — "Yool Team Report Generate"
# Script Type: API | API Method: yool_team_report_generate | Allow Guest: off
# Args: from_date, to_date, period_type (Month/Custom, optional — Month is detected from the dates).
# Managers only. Finds the Team Monthly Report for the period or creates it, then fills it from the
# tickets/expenses (fill logic lives in Server Script "Team Monthly Report Validate", triggered by
# doc.flags.yool_refresh). A report that is no longer Draft is returned as it is. Returns the name.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))
if not is_manager:
    frappe.throw("Only an Agent Manager or System Manager can generate the Team Monthly Report.", title="Not permitted")

from_date = frappe.form_dict.get("from_date")
to_date = frappe.form_dict.get("to_date")
if not from_date or not to_date:
    frappe.throw("Please set From Date and To Date.", title="Period required")
from_date = frappe.utils.getdate(from_date)
to_date = frappe.utils.getdate(to_date)

period_type = frappe.form_dict.get("period_type")
if period_type not in ("Month", "Custom"):
    month_end = frappe.utils.getdate(frappe.utils.get_last_day(from_date))
    if from_date.day == 1 and to_date == month_end:
        period_type = "Month"
    else:
        period_type = "Custom"

name = frappe.db.get_value("Team Monthly Report", {"from_date": from_date, "to_date": to_date}, "name")
if name:
    doc = frappe.get_doc("Team Monthly Report", name)
    if doc.status == "Draft":
        doc.flags.yool_refresh = 1
        doc.save(ignore_permissions=True)
else:
    doc = frappe.get_doc({
        "doctype": "Team Monthly Report",
        "period_type": period_type,
        "from_date": from_date,
        "to_date": to_date,
        "status": "Draft",
    })
    doc.flags.yool_refresh = 1
    doc.insert(ignore_permissions=True)

frappe.response["message"] = doc.name
