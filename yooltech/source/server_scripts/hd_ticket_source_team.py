# Server Script — "HD Ticket Source Team"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: Before Save
#
# HD Ticket.source_team (Custom Field, Select "\nSales\nTechnical", label "Ka yimid / Raised by team") says which
# team raised the work. NEW tickets only: when it is empty it defaults to the creator's HD Team
# (member of "Sales" -> Sales, else member of "Technical" -> Technical; portal customers / others stay empty).
# Teams are managed in Helpdesk -> Teams. Does not touch routing (agent_group) or assignment.
#
# Sales lane (2026-10-22): a NEW ticket with source_team = Sales that would start in the default new status
# (HD Settings / SLA "default ticket status", "New" = Kanban column CUSUB) starts in HD Ticket Status "Sales"
# (category Open, Kanban column SALES) instead. The Technical team picks it up from there by moving it to
# Assigned / In Progress. "HD Ticket Chatwoot Sync" sends no customer message for a change INTO Sales.
# Helpdesk's on_communication_update resets the status to the default new status on every "Received"
# Communication (also the ticket's own first description right after the insert, and later customer replies).
# A ticket still in the Sales lane stays there in that case (status change + last_customer_response change in the
# same save); a person moving it out (drag / status menu) is never blocked.

if doc.is_new() and not doc.source_team:
	creator = doc.owner or frappe.session.user
	for team in ["Sales", "Technical"]:
		if not doc.source_team and frappe.get_all("HD Team Member", filters={"parenttype": "HD Team", "parent": team, "user": creator}, pluck="name"):
			doc.source_team = team

if doc.is_new() and doc.source_team == "Sales" and frappe.db.exists("HD Ticket Status", {"name": "Sales", "enabled": 1}):
	default_new = None
	if doc.sla:
		default_new = frappe.db.get_value("HD Service Level Agreement", doc.sla, "default_ticket_status")
	default_new = default_new or frappe.db.get_single_value("HD Settings", "default_ticket_status") or "New"
	if not doc.status or doc.status == default_new:
		doc.status = "Sales"
		doc.status_category = "Open"

if not doc.is_new() and doc.source_team == "Sales" and doc.has_value_changed("status") and doc.has_value_changed("last_customer_response"):
	before = doc.get_doc_before_save()
	if before and before.status == "Sales":
		doc.status = "Sales"
		doc.status_category = "Open"
