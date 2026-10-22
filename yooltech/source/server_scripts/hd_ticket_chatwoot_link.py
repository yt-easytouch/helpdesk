# Server Script — "HD Ticket Chatwoot Link"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: After Insert
#
# Every NEW ticket made in Helpdesk is linked to the caller's WhatsApp conversation (Chatwoot default inbox):
#   phone = caller_phone, else the Contact's mobile, else the Customer's mobile (same last-9-digits rule)
#   - open conversation exists  -> link it + private note with the ticket link (no WhatsApp message)
#   - no open conversation      -> create one + ONE welcome WhatsApp (Chatwoot Settings "Welcome message"),
#                                  only when customer messages are on (test numbers / rate limit / JOOJI in the door)
# Tickets created FROM Chatwoot (label "ticket") are already linked and skipped. Old tickets are not touched.
# The link is kept in chatwoot_reply_conversation (one customer may have several tickets; chatwoot_conversation_id
# stays unique for label-created tickets). A Chatwoot problem never blocks creating the ticket.

# Everything (settings, passwords, int(), run_script) is inside try: nothing here may block the ticket save.
try:
	if not doc.chatwoot_conversation_id and doc.source != "Chatwoot":
		s = frappe.get_cached_doc("Chatwoot Settings")
		if s.enabled:
			phone = doc.caller_phone
			if not phone and doc.contact:
				phone = frappe.db.get_value("Contact", doc.contact, "mobile_no") or frappe.db.get_value("Contact", doc.contact, "phone")
			if not phone and (doc.erp_customer or doc.customer):
				phone = frappe.db.get_value("Customer", doc.erp_customer or doc.customer, "mobile_no")
			raw_p = str(phone or "").strip()
			digits = "".join([c for c in raw_p if c.isdigit()]).lstrip("0")
			if digits.startswith("252") and len(digits) == 12:
				digits = digits[3:]
			# Somali = 9 local digits; anything else must be a full international number (+ / 00 / 11+ digits,
			# 8-15 digits total — user-approved 2026-10-19: intl customers get the welcome message too),
			# passed with a leading + so intl() in the Chatwoot API door accepts it.
			is_intl = len(digits) != 9 and (raw_p.startswith("+") or raw_p.startswith("00") or len(digits) >= 11) and 8 <= len(digits) <= 15
			send_phone = ("+" + digits) if is_intl else digits
			if len(digits) != 9 and not is_intl:
				frappe.get_doc({"doctype": "Chatwoot Sync Log", "direction": "Outbound", "event": "link_ticket", "status": "Skipped",
					"reference_ticket": doc.name, "error": "No valid phone on the ticket, contact or customer"}).insert(ignore_permissions=True)
			else:
				ikey = s.get_password("internal_key", raise_exception=False)
				company = frappe.db.get_value("Customer", doc.erp_customer or doc.customer, "customer_name") if (doc.erp_customer or doc.customer) else None
				try:
					got = (run_script("Chatwoot API", action="ensure_conversation", internal_key=ikey, payload={"phone": send_phone, "ticket": doc.name,
						"name": doc.caller_name or company or (send_phone if is_intl else "+252" + digits), "company": company}) or {}).get("chatwoot_result") or {}
					conv = got.get("conversation_id")
					if conv:
						frappe.db.set_value("HD Ticket", doc.name, {"chatwoot_reply_conversation": str(conv),
							"chatwoot_contact_id": str(got.get("contact_id") or "")}, update_modified=False)
						link = (s.helpdesk_url or "https://portal.yool.tech").rstrip("/") + "/helpdesk/tickets/" + str(doc.name)
						run_script("Chatwoot API", action="add_private_note", internal_key=ikey, payload={"conversation_id": conv, "ticket": doc.name,
							"content": "🎫 Ticket #" + str(doc.name) + " created in Helpdesk: " + link})
						if got.get("new_conversation") and s.welcome_message_template:
							text = s.welcome_message_template.replace("{caller_name}", str(doc.caller_name or company or "")).replace(
								"{id}", str(doc.name)).replace("{subject}", str(doc.subject or ""))
							sent = (run_script("Chatwoot API", action="send_customer_message", internal_key=ikey, payload={"conversation_id": conv,
								"ticket": doc.name, "phone": send_phone, "kind": "welcome", "content": text}) or {}).get("chatwoot_result") or {}
							if sent.get("ok"):
								frappe.db.set_value("HD Ticket", doc.name, "chatwoot_welcome_sent", 1, update_modified=False)
				except Exception as e:
					frappe.log_error("Chatwoot link: ticket " + str(doc.name), str(e))
except Exception as e:
	frappe.log_error("Chatwoot link: ticket " + str(doc.name), str(e)[:1000])
