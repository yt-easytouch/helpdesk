# Server Script — "ToDo Chatwoot Agent Notify"
# Script Type: DocType Event | Reference Doctype: ToDo | Event: After Insert
#
# When an HD Ticket is assigned to an agent (Helpdesk creates a ToDo), that agent gets one WhatsApp message with the
# full ticket brief, sent through the Chatwoot door (action send_agent_message). The text is Chatwoot Settings
# "Agent assignment message". Phone: User mobile, else Employee cell number, else User phone; none -> Skipped log.
# Switch: Chatwoot Settings "Notify agents on assignment" (staff only, separate from the customer test mode).
# Never blocks the assignment.


def nz(v):
	v = str(v or "").strip()
	return v if v else "—"


def when(dt):
	if not dt:
		return "—"
	# "2026-10-18 10:44:00" -> "18-10-2026 10:44" (strftime is not available here)
	v = str(dt)
	if len(v) >= 16 and v[4] == "-":
		return v[8:10] + "-" + v[5:7] + "-" + v[0:4] + " " + v[11:16]
	return v[:16]


if doc.reference_type == "HD Ticket" and doc.allocated_to and doc.status == "Open":
	try:
		s = frappe.get_cached_doc("Chatwoot Settings")
		if s.enabled and s.notify_agents and s.agent_message_template:
			t = frappe.get_doc("HD Ticket", doc.reference_name)
			user = doc.allocated_to
			phone = frappe.db.get_value("User", user, "mobile_no") or frappe.db.get_value(
				"Employee", {"user_id": user, "status": "Active"}, "cell_number") or frappe.db.get_value("User", user, "phone")
			agent_name = frappe.db.get_value("HD Agent", user, "agent_name") or frappe.get_fullname(user)
			company = frappe.db.get_value("Customer", t.erp_customer or t.customer, "customer_name") if (t.erp_customer or t.customer) else None
			details = ""
			try:
				details = frappe.utils.strip_html(t.description or "")
			except Exception:
				details = str(t.description or "")
			details = " ".join(details.split())
			if len(details) > 300:
				details = details[:297] + "..."
			# Status as the Kanban column name agents see (HD Kanban Settings label), else the status itself.
			shown = t.status
			try:
				cols = (json.loads(frappe.db.get_single_value("HD Kanban Settings", "config") or "{}") or {}).get("columns") or {}
				shown = (cols.get(t.status) or {}).get("label") or t.status
			except Exception:
				shown = t.status
			link = (s.helpdesk_url or "https://portal.yool.tech").rstrip("/") + "/helpdesk/tickets/" + str(t.name)
			values = {
				"{agent}": nz(agent_name.split(" ")[0] if agent_name else ""),
				"{id}": str(t.name),
				"{subject}": nz(t.subject),
				"{company}": nz(company),
				"{caller}": nz(t.caller_name),
				"{caller_phone}": nz(t.caller_phone),
				"{priority}": nz(t.priority),
				"{status}": nz(shown),
				"{team}": nz(t.agent_group),
				"{type}": nz(t.ticket_type),
				"{first_response_by}": when(t.response_by),
				"{resolution_by}": when(t.resolution_by),
				"{details}": nz(details),
				"{link}": link,
				"{assigned_by}": nz(frappe.get_fullname(doc.assigned_by or frappe.session.user)),
			}
			text = s.agent_message_template
			for k in values:
				text = text.replace(k, values[k])
			run_script("Chatwoot API", action="send_agent_message", internal_key=s.get_password("internal_key", raise_exception=False),
				payload={"phone": phone, "name": agent_name, "ticket": t.name, "content": text})
	except Exception as e:
		frappe.log_error("Chatwoot agent notify: ToDo " + str(doc.name), str(e)[:500])
