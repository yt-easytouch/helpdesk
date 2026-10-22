# Server Script — "Chatwoot Inbound"
# Script Type: API | API Method: chatwoot_inbound | Allow Guest: No
#
# The one door in (Chatwoot -> Helpdesk). Only the Supabase bridge calls it, with the API key of
# Chatwoot Settings.bridge_user; the bridge has already checked the Chatwoot HMAC signature and
# forwards {delivery_id, event, signature_ok, reason?}. System Managers may call it to test.
# Every call writes one Inbound Chatwoot Sync Log row; its unique dedupe_key means the same
# delivery is never processed twice.
#
# conversation_updated with the ticket label -> one HD Ticket per conversation (unique
#   chatwoot_conversation_id), then a private note with the link back in Chatwoot.
# message_created "JOOJI" from the customer -> the linked ticket is marked opted out.
# All Chatwoot reads/writes go through the outbound door: run_script("Chatwoot API", ...).


def esc(text):
	return str(text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")


def caller_phone(raw):
	# Same rule as the HD Ticket Caller Validation script: +252 + 9 digits, or nothing.
	cleaned = "".join([c for c in str(raw or "").strip() if c not in " -.()"])
	digits = cleaned[1:] if cleaned.startswith("+") else (cleaned[2:] if cleaned.startswith("00") else cleaned)
	local = ""
	if digits.startswith("252") and len(digits) == 12:
		local = digits[3:]
	elif digits.startswith("0") and len(digits) == 10:
		local = digits[1:]
	elif len(digits) == 9:
		local = digits
	if not digits.isdigit() or not local.isdigit() or len(local) != 9 or local[0] == "0":
		return None
	return "+252" + local


def n9(phone):
	# The join key: digits only, no leading zeros, 252 prefix, compared on the last 9 digits.
	d = "".join([c for c in str(phone or "") if c.isdigit()]).lstrip("0")
	if not d:
		return ""
	if not d.startswith("252"):
		d = "252" + d
	return d[-9:]


def door(action, payload):
	flags = run_script("Chatwoot API", action=action, payload=payload)
	return (flags or {}).get("chatwoot_result") or {}


def fmt_ts(ts):
	# Chatwoot sends Unix seconds (UTC); shown in Mogadishu time (UTC+3, no DST).
	try:
		epoch = frappe.utils.get_datetime("1970-01-01 00:00:00")
		return frappe.utils.add_to_date(epoch, seconds=int(ts) + 3 * 3600).strftime("%d-%m-%Y %H:%M")
	except Exception:
		return ""


def label_names(labels):
	out = []
	for x in labels or []:
		out.append(x.get("title") if isinstance(x, dict) else str(x))
	return out


args = frappe.form_dict
s = frappe.get_doc("Chatwoot Settings")
user = frappe.session.user
admin = user == "Administrator" or bool(frappe.get_all(
	"Has Role", filters={"parent": user, "parenttype": "User", "role": "System Manager"}, pluck="role"))
if not admin and (not s.bridge_user or user != s.bridge_user):
	frappe.throw("Not permitted", frappe.PermissionError)

event = args.get("event") or {}
if isinstance(event, str):
	event = json.loads(event) if event.strip() else {}
name = str(event.get("event") or args.get("event_name") or "unknown")
delivery = str(args.get("delivery_id") or "").strip()
# Webhook "id" of a conversation is its display id, the one used in Chatwoot URLs and the API.
if name.startswith("conversation_"):
	conv_id = event.get("id")
else:
	conv_id = (event.get("conversation") or {}).get("display_id") or (event.get("conversation") or {}).get("id")
dedupe = ("cw:" + delivery) if delivery else ("cw:" + name + ":" + str(conv_id or "") + ":" + str(event.get("id") or "") + ":" + str(event.get("updated_at") or event.get("created_at") or ""))

log = frappe.get_doc({
	"doctype": "Chatwoot Sync Log",
	"direction": "Inbound",
	"event": name,
	"status": "Success",
	"chatwoot_conversation_id": conv_id,
	"method": "POST",
	"path": "/api/method/chatwoot_inbound",
	"request": json.dumps({"delivery_id": delivery, "signature_ok": args.get("signature_ok"), "event": event}, indent=1, default=str)[:60000],
})
result = {"ok": True, "event": name}

if not args.get("signature_ok"):
	# The bridge rejected the HMAC; Frappe only records it.
	log.status = "Rejected"
	log.error = str(args.get("reason") or "Invalid or missing signature")[:500]
	log.insert(ignore_permissions=True)
	result = {"ok": False, "rejected": True, "log": log.name}
elif frappe.db.exists("Chatwoot Sync Log", {"dedupe_key": dedupe}):
	log.status = "Duplicate"
	log.error = "Already processed: " + dedupe
	log.insert(ignore_permissions=True)
	result = {"ok": True, "duplicate": True, "log": log.name}
else:
	log.dedupe_key = dedupe
	log.insert(ignore_permissions=True)
	note = None
	if not s.enabled:
		log.status = "Skipped"
		note = "Integration is disabled in Chatwoot Settings"

	elif name == "conversation_updated" or name == "conversation_created":
		label = (s.ticket_label or "ticket").strip()
		labels = label_names(event.get("labels"))
		existing = frappe.db.get_value("HD Ticket", {"chatwoot_conversation_id": str(conv_id)}, ["name", "status"], as_dict=True) if conv_id else None
		if not conv_id or label not in labels:
			log.status = "Skipped"
			note = "No '" + label + "' label"
		elif existing:
			# Idempotent: one ticket per conversation, whatever happens to the label.
			log.status = "Skipped"
			log.reference_ticket = existing.name
			note = "Ticket #" + str(existing.name) + " already exists (" + str(existing.status) + ")"
		else:
			# Read the conversation from Chatwoot itself (the webhook body is only a trigger).
			got = door("get_conversation", {"conversation_id": conv_id, "with_messages": True})
			if not got.get("ok"):
				log.status = "Failed"
				note = "Could not read conversation from Chatwoot (HTTP " + str(got.get("status")) + ")"
			else:
				c = got.get("conversation") or {}
				meta = c.get("meta") or {}
				sender = meta.get("sender") or {}
				assignee = meta.get("assignee") or {}
				msgs = []
				for m in got.get("messages") or []:
					if m.get("message_type") in [0, 1, "incoming", "outgoing"] and not m.get("private") and (m.get("content") or "").strip():
						msgs.append(m)
				first_in = None
				opted_out = False
				for m in msgs:
					incoming = m.get("message_type") in [0, "incoming"]
					if incoming and first_in is None:
						first_in = m
					if incoming and (m.get("content") or "").strip().upper() == "JOOJI":
						opted_out = True
				ca = sender.get("custom_attributes") or {}
				if ca.get("opted_out") in [True, 1, "true", "yes"]:
					opted_out = True

				subject = " ".join(str((first_in or {}).get("content") or "").split())
				subject = (subject[:137] + "...") if len(subject) > 140 else subject
				if not subject:
					subject = "Chatwoot #" + str(conv_id)

				base = (s.base_url or "").rstrip("/")
				conv_url = base + "/app/accounts/" + str(s.account_id) + "/conversations/" + str(conv_id)
				lines = []
				for m in msgs[-10:]:
					who = (m.get("sender") or {}).get("name") or ("Customer" if m.get("message_type") in [0, "incoming"] else "Agent")
					when = fmt_ts(m.get("created_at"))
					lines.append("<p><b>" + esc(who) + "</b>" + (" · " + when if when else "") + "<br>" + esc(m.get("content")) + "</p>")
				description = "".join(lines) + '<p><a href="' + conv_url + '">Open in Chatwoot #' + str(conv_id) + "</a></p>"

				# Company: only when the phone points to exactly one Customer (last 9 digits).
				key = n9(sender.get("phone_number"))
				customer = None
				candidates = []
				if len(key) == 9:
					rows = frappe.db.sql(
						"""select distinct dl.link_name from `tabContact` c
						join `tabDynamic Link` dl on dl.parent = c.name and dl.parenttype = 'Contact' and dl.link_doctype = 'Customer'
						left join `tabContact Phone` cp on cp.parent = c.name
						where right(regexp_replace(coalesce(cp.phone, ''), '[^0-9]', ''), 9) = %(k)s
							or right(regexp_replace(coalesce(c.mobile_no, ''), '[^0-9]', ''), 9) = %(k)s
							or right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', ''), 9) = %(k)s
						union
						select name from `tabCustomer` where right(regexp_replace(coalesce(mobile_no, ''), '[^0-9]', ''), 9) = %(k)s""",
						{"k": key},
					)
					for r in rows:
						candidates.append(r[0])
					if len(candidates) == 1:
						customer = candidates[0]

				# Assignee: mapped HD Agent by Chatwoot agent id or email; otherwise Unassigned.
				hd_agent = None
				for row in s.agent_map or []:
					if row.hd_agent and ((assignee.get("id") and row.chatwoot_agent_id == assignee.get("id")) or
						(assignee.get("email") and (row.chatwoot_email or "").lower() == (assignee.get("email") or "").lower())):
						hd_agent = row.hd_agent

				ticket = frappe.get_doc({
					"doctype": "HD Ticket",
					"subject": subject,
					"description": description,
					"caller_name": (sender.get("name") or "").strip() or None,
					"caller_phone": caller_phone(sender.get("phone_number")),
					"erp_customer": customer,
					"source": "Chatwoot",
					"chatwoot_conversation_id": str(conv_id),
					"chatwoot_contact_id": str(sender.get("id") or "") or None,
					"chatwoot_inbox": str(c.get("inbox_id") or ""),
					"chatwoot_opted_out": 1 if opted_out else 0,
				})
				try:
					ticket.insert(ignore_permissions=True)
				except frappe.UniqueValidationError:
					ticket = None
				except frappe.DuplicateEntryError:
					ticket = None
				if ticket is None:
					# Two deliveries raced; the other one created it.
					log.status = "Duplicate"
					log.reference_ticket = frappe.db.get_value("HD Ticket", {"chatwoot_conversation_id": str(conv_id)}, "name")
					note = "Ticket already created by a parallel delivery"
				else:
					log.reference_ticket = ticket.name
					details = ["Ticket #" + str(ticket.name) + " created"]
					details.append("Company: " + (customer or ("ambiguous: " + ", ".join(candidates[:5]) if candidates else "no match")))
					if hd_agent:
						try:
							ticket.assign_agent(hd_agent)
							details.append("Assigned: " + hd_agent)
						except Exception as e:
							details.append("Assign failed: " + str(e)[:200])
					else:
						details.append("Unassigned")
					if opted_out:
						details.append("Opted out (JOOJI)")
					link = (s.helpdesk_url or "https://my.yool.tech").rstrip("/") + "/helpdesk/tickets/" + str(ticket.name)
					sent = door("add_private_note", {"conversation_id": conv_id, "ticket": ticket.name,
						"content": "🎫 Ticket #" + str(ticket.name) + " created: " + link})
					details.append("Private note: " + ("sent" if sent.get("ok") else "FAILED, see " + str(sent.get("log"))))
					note = "; ".join(details)
					result["ticket"] = ticket.name

	elif name == "message_created":
		# JOOJI from the customer: never message them automatically.
		msg_type = event.get("message_type")
		text = (event.get("content") or "").strip().upper()
		if msg_type in [0, "incoming"] and text == "JOOJI" and conv_id:
			t = frappe.db.get_value("HD Ticket", {"chatwoot_conversation_id": str(conv_id)}, "name")
			if t:
				frappe.db.set_value("HD Ticket", t, "chatwoot_opted_out", 1, update_modified=False)
				log.reference_ticket = t
				note = "Opt-out recorded on ticket #" + str(t)
			else:
				note = "JOOJI received; no linked ticket"
		else:
			log.status = "Skipped"
			note = "Not a JOOJI message"
	else:
		log.status = "Skipped"
		note = "Event not handled"

	log.response = json.dumps({"result": note}, default=str)
	if log.status == "Failed":
		log.error = note
	log.save(ignore_permissions=True)
	result["status"] = log.status
	result["note"] = note
	result["log"] = log.name

frappe.flags.chatwoot_inbound = result
