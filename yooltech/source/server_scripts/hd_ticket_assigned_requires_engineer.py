# Server Script -- "HD Ticket Assigned Requires Engineer"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: Before Save
#
# A ticket may only ENTER the status "Assigned" (Kanban column) when at least one of its assignees is a member of
# HD Team "Technical" (the single place that lists engineers). Other statuses and other edits of a ticket that is
# already Assigned are never blocked. Assignees = _assign (DB value, then the in-memory doc) + open ToDos; on a new
# ticket the Kanban new-ticket form passes its "Assign to" pick as form_dict.yool_assign_to (the assignment itself
# runs right after the insert). Empty Technical team = no check (same fallback as the reports).
# The Kanban asks for the engineer first (modal "Dooro injineerka / Assign engineer"); this is the safety net, and
# the Kanban recognises the error text below, opens the modal and retries once. Plain text only (Helpdesk toasts
# show HTML literally). No Helpdesk default sets "Assigned" (default New, reopen Reopened, auto_update_status off).

if doc.status == "Assigned" and doc.has_value_changed("status"):
	tech = frappe.get_all("HD Team Member", filters={"parent": "Technical", "parenttype": "HD Team"}, pluck="user")
	if tech:
		users = []
		raw = []
		if not doc.is_new():
			raw.append(frappe.db.get_value("HD Ticket", doc.name, "_assign"))
		raw.append(doc.get("_assign"))
		for r in raw:
			try:
				for u in json.loads(r or "[]") or []:
					users.append(u)
			except Exception:
				pass
		if not doc.is_new():
			for u in frappe.get_all("ToDo", filters={"reference_type": "HD Ticket", "reference_name": doc.name,
					"status": "Open"}, pluck="allocated_to"):
				users.append(u)
		else:
			pick = frappe.form_dict.get("yool_assign_to")
			if pick:
				users.append(pick)
		if not [u for u in users if u in tech]:
			frappe.throw("Fadlan u xilsaar injineer kooxda Technical ka hor Assigned. / Assign a Technical engineer before moving to Assigned.")
