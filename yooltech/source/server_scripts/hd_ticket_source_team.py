# Server Script — "HD Ticket Source Team"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: Before Save
#
# HD Ticket.source_team (Custom Field, Select "\nSales\nTechnical", label "Ka yimid / Raised by team") says which
# team raised the work. NEW tickets only: when it is empty it defaults to the creator's HD Team
# (member of "Sales" -> Sales, else member of "Technical" -> Technical; portal customers / others stay empty).
# Teams are managed in Helpdesk -> Teams. Does not touch routing (agent_group) or assignment.

if doc.is_new() and not doc.source_team:
	creator = doc.owner or frappe.session.user
	for team in ["Sales", "Technical"]:
		if not doc.source_team and frappe.get_all("HD Team Member", filters={"parenttype": "HD Team", "parent": team, "user": creator}, pluck="name"):
			doc.source_team = team
