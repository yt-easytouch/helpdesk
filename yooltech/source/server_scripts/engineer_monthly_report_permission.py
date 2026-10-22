# Server Script — "Engineer Monthly Report Permission"
# Script Type: Permission Query | Reference Doctype: Engineer Monthly Report
# Agent Manager / System Manager see every report; everyone else only reports where they are the engineer.

user = frappe.session.user
is_manager = user == "Administrator" or bool(frappe.db.sql(
    "SELECT 1 FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(u)s"
    " AND role IN ('Agent Manager', 'System Manager') LIMIT 1",
    {"u": user},
))
if is_manager:
    conditions = ""
else:
    conditions = "`tabEngineer Monthly Report`.`engineer` = " + frappe.db.escape(user)
