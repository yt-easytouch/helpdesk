# Server Script -- "HD Ticket Chatwoot Sync"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: After Save
#
# Helpdesk -> Chatwoot on every status change (every Kanban column a ticket moves to):
#   0. NO linked conversation yet (customer never wrote on WhatsApp, or the insert-time link was skipped/failed):
#      resolve the customer's phone (caller_phone -> Contact mobile/phone -> Customer mobile), then
#      "ensure_conversation" in the Chatwoot API door finds-or-creates the Chatwoot contact (name from
#      caller_name, else the Customer, else the number) and a WhatsApp conversation in the default inbox, and the
#      ids are stored in chatwoot_reply_conversation / chatwoot_contact_id. Creating a contact or conversation
#      sends NOTHING by itself. The WhatsApp inbox is Channel::Api (unofficial gateway via wa-app.sadarsms.com,
#      source_id 252...@s.whatsapp.net), so free-form text reaches brand-new contacts too: no Meta Cloud API
#      24h window and no approved-template requirement. Auto-create only runs when customer messages are on,
#      WhatsApp is not paused and the ticket has not opted out; no valid phone or a failed create writes one
#      plain-text Chatwoot Sync Log row (event auto_link_status, status Skipped/Failed).
#   1. ONE customer-facing message (normal/public, message_type outgoing, private false -- goes out on WhatsApp)
#      in professional Somali announcing the new status, signed "— Yooltech Support" (real em dash in the live string). No internal links.
#      User decision 2026-10-19: this REPLACES both the old private note ("Ticket #... -> Status by Agent" + portal
#      link) and the old per-status template message (Chatwoot Settings.status_messages / customer_message_template
#      are no longer read here). JOOJI opt-out, "Send customer-facing messages", WhatsApp pause, Test numbers and
#      the rate limit are all still enforced inside "Chatwoot API".
#   2. Resolved/Closed: label "ticket-resolved" on the conversation
#   Assigned names the engineer: "... waxaa loo xilsaaray injineerkeena <Name> (<+252 phone>), waana ..." (see below).
# "Sales" (2026-10-22) is an internal intake lane (Kanban column SALES, Server Script "HD Ticket Source Team"):
# a change INTO Sales sends nothing to the customer; moving OUT of it (Assigned / In Progress ...) sends as usual.
# Everything goes through the outbound door (Chatwoot API) and is logged in Chatwoot Sync Log there.
# A Chatwoot problem never blocks saving the ticket.

# Everything (settings, passwords, int(), run_script) is inside try: nothing here may block the ticket save.
try:
	if doc.has_value_changed("status") and not doc.flags.in_insert and doc.status != "Sales":
		s = frappe.get_cached_doc("Chatwoot Settings")
		if s.enabled:
			ikey = s.get_password("internal_key", raise_exception=False)
			conv = doc.chatwoot_conversation_id or doc.chatwoot_reply_conversation
			# The customer's phone: caller_phone, else the Contact's, else the Customer's (same rule as the link script).
			phone = doc.caller_phone
			if not phone and doc.contact:
				phone = frappe.db.get_value("Contact", doc.contact, "mobile_no") or frappe.db.get_value("Contact", doc.contact, "phone")
			if not phone and (doc.erp_customer or doc.customer):
				phone = frappe.db.get_value("Customer", doc.erp_customer or doc.customer, "mobile_no")
			raw_p = str(phone or "").strip()
			digits = "".join([c for c in raw_p if c.isdigit()]).lstrip("0")
			if digits.startswith("252") and len(digits) == 12:
				digits = digits[3:]
			# Somali = 9 local digits; anything else must be a full international number (+ / 00 / 11+ digits),
			# passed with a leading + so intl() in the Chatwoot API door accepts it.
			is_intl = len(digits) != 9 and (raw_p.startswith("+") or raw_p.startswith("00") or len(digits) >= 11) and 8 <= len(digits) <= 15
			send_phone = ("+" + digits) if is_intl else digits
			if not conv and s.send_customer_messages and not s.whatsapp_paused and not doc.chatwoot_opted_out:
				# 0. Auto-link so the status message below has somewhere to go. Delivery itself is still gated in
				#    the door (Test numbers, JOOJI, rate limit); this step only creates/finds contact + conversation.
				if len(digits) != 9 and not is_intl:
					frappe.get_doc({"doctype": "Chatwoot Sync Log", "direction": "Outbound", "event": "auto_link_status",
						"status": "Skipped", "reference_ticket": doc.name,
						"error": "Status message not sent: no valid phone on the ticket, contact or customer"}).insert(ignore_permissions=True)
				else:
					company = frappe.db.get_value("Customer", doc.erp_customer or doc.customer, "customer_name") if (doc.erp_customer or doc.customer) else None
					got = (run_script("Chatwoot API", action="ensure_conversation", internal_key=ikey,
						payload={"phone": send_phone, "ticket": doc.name,
							"name": doc.caller_name or company or (send_phone if is_intl else "+252" + digits),
							"company": company}) or {}).get("chatwoot_result") or {}
					if got.get("conversation_id"):
						conv = got.get("conversation_id")
						frappe.db.set_value("HD Ticket", doc.name, {"chatwoot_reply_conversation": str(conv),
							"chatwoot_contact_id": str(got.get("contact_id") or "")}, update_modified=False)
					else:
						frappe.get_doc({"doctype": "Chatwoot Sync Log", "direction": "Outbound", "event": "auto_link_status",
							"status": "Failed", "reference_ticket": doc.name,
							"error": "Could not find or create the WhatsApp conversation (see the ensure_conversation rows above)"}).insert(ignore_permissions=True)
			if conv:
				conv = int(conv)
				category = frappe.db.get_value("HD Ticket Status", doc.status, "category") or ""
				# One line, plain text: collapse any whitespace/newlines in the subject.
				subject = " ".join(str(doc.subject or "").split())
				# Assigned (2026-10-22): name the engineer + phone, read at SEND time (the Kanban assigns first, then moves;
				# Server Script "HD Ticket Assigned Requires Engineer" guarantees a Technical assignee). Assignees =
				# _assign from the DB, else the doc, plus open ToDos; the first HD Team "Technical" member wins (else the
				# first assignee). Name = the User's full name, else HD Agent agent_name. Phone = User mobile_no / phone,
				# else the active Employee's cell_number (Employee.user_id), normalized to +252XXXXXXXXX (Somali 9 digits)
				# or +<digits> (other countries, 8-15 digits); no phone -> no parentheses.
				engineer = ""
				if str(doc.status) == "Assigned":
					try:
						tech = frappe.get_all("HD Team Member", filters={"parent": "Technical", "parenttype": "HD Team"}, pluck="user")
						users = []
						for r in [frappe.db.get_value("HD Ticket", doc.name, "_assign"), doc.get("_assign")]:
							try:
								for u in json.loads(r or "[]") or []:
									if u and u not in users:
										users.append(u)
							except Exception:
								pass
						for u in frappe.get_all("ToDo", filters={"reference_type": "HD Ticket", "reference_name": doc.name,
								"status": "Open"}, pluck="allocated_to", order_by="creation asc"):
							if u and u not in users:
								users.append(u)
						picks = [u for u in users if u in tech] or users
						if picks:
							eu = picks[0]
							ename = frappe.db.get_value("User", eu, "full_name") or frappe.db.get_value("HD Agent", eu, "agent_name") or ""
							ename = " ".join(str(ename).split())
							eph = frappe.db.get_value("User", eu, "mobile_no") or frappe.db.get_value("User", eu, "phone") or frappe.db.get_value(
								"Employee", {"user_id": eu, "status": "Active"}, "cell_number") or ""
							eraw = str(eph).strip()
							ed = "".join([c for c in eraw if c.isdigit()])
							if ed.startswith("00"):
								ed = ed[2:]
							elif ed.startswith("0") and len(ed) == 10:
								ed = ed[1:]
							if ed.startswith("252") and len(ed) == 12:
								ed = ed[3:]
							if len(ed) == 9:
								ephone = "+252" + ed
							elif 8 <= len(ed) <= 15:
								ephone = "+" + ed
							else:
								ephone = ""
							if ename:
								engineer = ename + ((" (" + ephone + ")") if ephone else "")
					except Exception as e:
						frappe.log_error("Chatwoot sync: engineer for ticket " + str(doc.name), str(e)[:500])
				somali = {
					"Assigned": "Codsigaaga #{id} ({subject}) waxaa loo xilsaaray injineerkeena" + ((" " + engineer) if engineer else "") + ", waana lagu soo socodsiin doonaa.",
					"In Progress": "Codsigaaga #{id} ({subject}) hadda waa laga shaqaynayaa.",
					"Paused": "Codsigaaga #{id} ({subject}) si kumeelgaadh ah ayaa loo hakiyay; waanu kula soo xidhiidhi doonnaa.",
					"Resolved": "Codsigaagii #{id} ({subject}) waa la xalliyay. Waad ku mahadsan tahay samirkaaga.",
					"Closed": "Codsigaagii #{id} ({subject}) waa la xidhay. Haddii aad caawimo dheeri ah u baahato, fadlan nala soo xidhiidh.",
					"Cancelled": "Codsigaagii #{id} ({subject}) waa la joojiyay. Faahfaahin dheeri ah, fadlan nala soo xidhiidh.",
					"Reopened": "Codsigaagii #{id} ({subject}) dib ayaa loo furay, waana laga shaqaynayaa.",
				}
				# Unknown/custom statuses fall back to a generic Somali line naming the status.
				tpl = somali.get(str(doc.status)) or "Codsigaaga #{id} ({subject}): heerka cusub waa {status}."
				text = (tpl.replace("{id}", str(doc.name)).replace("{subject}", subject)
					.replace("{status}", str(doc.status)) + " — Yooltech Support")
				calls = [
					["send_customer_message", {"conversation_id": conv, "ticket": doc.name, "content": text,
						"phone": phone or doc.caller_phone}],
				]
				if category == "Resolved" or doc.status in ["Resolved", "Closed"]:
					calls.append(["set_conversation_label", {"conversation_id": conv, "ticket": doc.name,
						"add": [s.resolved_label or "ticket-resolved"]}])
				for c in calls:
					try:
						run_script("Chatwoot API", action=c[0], payload=c[1], internal_key=ikey)
					except Exception as e:
						frappe.log_error("Chatwoot sync: " + c[0] + " for ticket " + str(doc.name), str(e))
except Exception as e:
	frappe.log_error("Chatwoot sync: ticket " + str(doc.name), str(e)[:1000])
