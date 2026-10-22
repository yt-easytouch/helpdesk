# Server Script — "Yool Team Report Refresh"
# Script Type: API | API Method: yool_team_report_refresh | Allow Guest: off
# Args: name. Re-pulls the tickets/expenses into an existing Team Monthly Report (see Server Script
# "Team Monthly Report Validate"): summary numbers and computed tables are replaced; typed text
# (hordhac / nuxur_* edited by people, challenges, feedback) is never erased, only new suggestion rows
# are added. Managers only; an Approved report can no longer be refreshed.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))
if not is_manager:
    frappe.throw("Only an Agent Manager or System Manager can refresh the Team Monthly Report.", title="Not permitted")

name = frappe.form_dict.get("name")
if not name or not frappe.db.exists("Team Monthly Report", name):
    frappe.throw("Team Monthly Report not found.", title="Not found")
doc = frappe.get_doc("Team Monthly Report", name)
if doc.status == "Approved":
    frappe.throw("This report is Approved and can no longer be refreshed.", title="Not permitted")

doc.flags.yool_refresh = 1
doc.save(ignore_permissions=True)
frappe.response["message"] = doc.name
