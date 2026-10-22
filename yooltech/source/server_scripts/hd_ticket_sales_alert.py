# Server Script — "HD Ticket Sales Alert"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: After Insert
#
# A NEW ticket with source_team = "Sales" sends ONE WhatsApp brief to the Technical team number, through the
# Chatwoot door (action send_agent_message = ensure_conversation for the number + one outgoing message; the
# conversation is left resolved). The door applies the WhatsApp pause (Kanban switch), Chatwoot Settings
# "Notify agents on assignment" (the staff-message toggle), the rate limit, and writes Chatwoot Sync Log rows.
# Assignee shown: the Kanban new-ticket form passes its "Assign to" pick as form_dict.yool_assign_to (it assigns
# right after the insert); otherwise any assignment already present. Never blocks creating the ticket.

# Team WhatsApp numbers are NOT stored in code (public repo). Admins set them in
# Chatwoot Settings -> "Sales alert: Technical team number" / "Sales alert: Sales team number"
# (custom fields sales_alert_tech_phone / sales_alert_sales_phone). Empty Technical number = no alert.
TECH_PHONE = ""
SALES_PHONE = ""


def nz(v, empty):
	v = " ".join(str(v or "").split())
	return v if v else empty


if doc.source_team == "Sales":
	try:
		s = frappe.get_cached_doc("Chatwoot Settings")
		TECH_PHONE = str(s.get("sales_alert_tech_phone") or "").strip()
		SALES_PHONE = str(s.get("sales_alert_sales_phone") or "").strip()
		cust = doc.erp_customer or doc.customer
		company = frappe.db.get_value("Customer", cust, "customer_name") if cust else None
		assignee = None
		pick = str(frappe.form_dict.get("yool_assign_to") or "").strip()
		if pick:
			assignee = frappe.db.get_value("HD Agent", {"name": pick, "is_active": 1}, "agent_name")
		if not assignee:
			users = []
			try:
				users = json.loads(doc.get("_assign") or "[]") or []
			except Exception:
				users = []
			if not users:
				users = frappe.get_all("ToDo", filters={"reference_type": "HD Ticket", "reference_name": doc.name, "status": "Open"}, pluck="allocated_to")
			names = []
			for u in users:
				names.append(frappe.db.get_value("HD Agent", u, "agent_name") or frappe.get_fullname(u))
			assignee = ", ".join(names)
		details = ""
		try:
			details = frappe.utils.strip_html(doc.description or "")
		except Exception:
			details = str(doc.description or "")
		details = " ".join(details.replace("&nbsp;", " ").split())
		if len(details) > 200:
			details = details[:197] + "..."
		link = (s.helpdesk_url or "https://portal.yool.tech").rstrip("/") + "/helpdesk/tickets/" + str(doc.name)
		lines = [
			"📥 Shaqo cusub oo ka timid Kooxda Sales",
			"Ticket #" + str(doc.name) + " — " + nz(doc.subject, "(cinwaan la’aan)"),
			"",
			"🏢 Shirkadda: " + nz(company, "—"),
			"👤 Macmiilka: " + nz(doc.caller_name, "—") + " · " + nz(doc.caller_phone, "—"),
			"⚡ Mudnaanta: " + nz(doc.priority, "—"),
			"👷 Loo xilsaaray: " + nz(assignee, "Weli lama xilsaarin"),
			"📝 Faahfaahin: " + nz(details, "—"),
			"",
			"Waxaa soo gudbiyay: " + nz(frappe.get_fullname(doc.owner), doc.owner) + " (Kooxda Sales" + (" · " + SALES_PHONE if SALES_PHONE else "") + ")",
			"Fadlan qabso shaqadan; wixii su’aal ah kala xiriir Kooxda Sales.",
			"🔗 " + link,
			"— Yooltech Helpdesk",
		]
		if TECH_PHONE:
			run_script("Chatwoot API", action="send_agent_message", internal_key=s.get_password("internal_key", raise_exception=False),
				payload={"phone": TECH_PHONE, "name": "Kooxda Technical (Yooltech)", "ticket": doc.name, "content": "\n".join(lines)})
	except Exception as e:
		frappe.log_error("Sales alert: ticket " + str(doc.name), str(e)[:1000])
