# Server Script — "Yool Engineer Report Refresh"
# Script Type: API | API Method: yool_engineer_report_refresh | Allow Guest: off
# Args: name. Re-pulls the tickets into an existing report (see "Engineer Monthly Report Validate"):
# activities + summary numbers are replaced, typed challenges/feedback/head comment are kept, new
# suggestions are only added. Engineers can refresh their own Draft report; managers any non-Approved one.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))

name = frappe.form_dict.get("name")
if not name or not frappe.db.exists("Engineer Monthly Report", name):
    frappe.throw("Engineer Monthly Report not found.", title="Not found")
doc = frappe.get_doc("Engineer Monthly Report", name)
if not is_manager and doc.engineer != user:
    frappe.throw("You can only refresh your own Engineer Monthly Report.", title="Not permitted")
if doc.status == "Approved":
    frappe.throw("This report is Approved and can no longer be refreshed.", title="Not permitted")
if doc.status != "Draft" and not is_manager:
    frappe.throw("This report is " + doc.status + ". Only an Agent Manager can refresh it now.", title="Not permitted")

doc.flags.yool_refresh = 1
doc.save(ignore_permissions=True)
frappe.response["message"] = doc.name
