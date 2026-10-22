# Server Script — "Chatwoot Webhook"
# Script Type: API | API Method: chatwoot_webhook_<webhook_key> (set by the door's setup_webhook) | Allow Guest: Yes
#
# The one door in (Chatwoot -> Helpdesk), replaces the bridge-based "Chatwoot Inbound".
#   HTTP:     Chatwoot account webhook -> POST /api/method/chatwoot_webhook_<Chatwoot Settings.webhook_key>
#             (runs as Guest). The key is in the method name because Frappe drops ?query args when the body is
#             JSON and safe_exec cannot read headers. form_dict.cmd must equal "chatwoot_webhook_" + the stored key.
#             Wrong keys never get here (Frappe: method not found); keyless calls hit the decoy "Chatwoot Webhook Old URL".
#   Internal: run_script("Chatwoot Webhook", conversation_id=..., source="poll") from "Chatwoot Poll"
#             (scheduler, runs as Administrator; no key). HTTP = form_dict.cmd starts with chatwoot_webhook, or the user is Guest.
# Order: rate limit -> key -> enabled -> event filter -> dedupe -> ticket exists? -> hint has label? -> fetch.
# The payload is only a hint: the ticket is built ONLY from the conversation re-read through the outbound door.
# Every call writes one Inbound Chatwoot Sync Log row (the key, cmd and the request URL are never stored).
# Result in frappe.flags.chatwoot_webhook (HTTP callers get {"message": {"chatwoot_webhook": ...}}).

RAISED_BY_FALLBACK = "chatwoot@yool.tech"
RATE_LIMIT = 120  # Inbound rows per 60 s


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


def door(action, payload, wkey):
	# wkey: the webhook key again, so the door accepts this Guest call (None in poll mode = Administrator).
	flags = run_script("Chatwoot API", action=action, payload=payload, webhook_key=wkey)
	return (flags or {}).get("chatwoot_result") or {}


def fmt_ts(ts):
	# Chatwoot sends Unix seconds (UTC); shown in Mogadishu time (UTC+3, no DST).
	try:
		epoch = frappe.utils.get_datetime("1970-01-01 00:00:00")
		v = str(frappe.utils.add_to_date(epoch, seconds=int(ts) + 3 * 3600))  # strftime is not available here
		return v[8:10] + "-" + v[5:7] + "-" + v[0:4] + " " + v[11:16]
	except Exception:
		return ""


def label_names(labels):
	out = []
	for x in labels or []:
		out.append(x.get("title") if isinstance(x, dict) else str(x))
	return out


def plain_email(v):
	v = str(v or "").strip().lower()
	at = v.find("@")
	if at > 0 and "." in v[at:] and " " not in v and "<" not in v and len(v) <= 140:
		return v
	return None


def new_log(status, event, conv, error, request):
	return frappe.get_doc({
		"doctype": "Chatwoot Sync Log",
		"direction": "Inbound",
		"event": event,
		"status": status,
		"chatwoot_conversation_id": conv,
		"method": "POST",
		"path": "/api/method/chatwoot_webhook",
		"request": request,
		"error": error,
	}).insert(ignore_permissions=True).name


args = frappe.form_dict
s = frappe.get_doc("Chatwoot Settings")
user = frappe.session.user
# frappe.request does not exist in safe_exec; form_dict.cmd is the /api/method/<cmd> really running.
# Guest is always treated as HTTP (key required), whatever the route (/api/v2 leaves cmd empty).
cmd = str(args.get("cmd") or "")
http = cmd.startswith("chatwoot_webhook") or user == "Guest"
result = {"ok": False}
stop = False

if http:
	since = frappe.utils.add_to_date(frappe.utils.now_datetime(), seconds=-60)
	recent = frappe.db.count("Chatwoot Sync Log", {"direction": "Inbound", "creation": [">", since]})
	# At most one Rejected row per minute (any reason), so a flood can neither fill the table nor push the
	# rate-limit count up and block real deliveries.
	quiet = bool(frappe.db.exists("Chatwoot Sync Log", {"direction": "Inbound", "status": "Rejected", "creation": [">", since]}))
	if recent > RATE_LIMIT:
		if not quiet:
			new_log("Rejected", str(args.get("event") or "unknown")[:140], None, "rate limit", None)
		result = {"ok": False, "rejected": True}
		stop = True
	else:
		wkey = s.get_password("webhook_key", raise_exception=False) or ""
		if len(wkey) < 32 or cmd != "chatwoot_webhook_" + wkey:
			if not quiet:
				new_log("Rejected", str(args.get("event") or "unknown")[:140], None,
					"No webhook key configured" if len(wkey) < 32 else "Key does not match", None)
			result = {"ok": False, "rejected": True}
			stop = True
else:
	# Internal call (poller). Not reachable over HTTP: that path always takes the key branch above.
	admin = user == "Administrator" or bool(frappe.get_all(
		"Has Role", filters={"parent": user, "parenttype": "User", "role": "System Manager"}, pluck="role"))
	if not admin:
		frappe.throw("Not permitted", frappe.PermissionError)
	wkey = None

if not stop:
	if http:
		name = str(args.get("event") or "unknown")[:140]
		conv_id = args.get("id")
		hint_labels = args.get("labels")
	else:
		name = "poll"
		conv_id = args.get("conversation_id")
		hint_labels = None
	try:
		conv_id = int(conv_id or 0) or None
	except Exception:
		conv_id = None
	handled = name in ["conversation_updated", "conversation_created", "conversation_status_changed", "poll"]

	if not s.enabled:
		result = {"ok": True, "status": "Skipped", "log": new_log("Skipped", name, conv_id, "Integration is disabled in Chatwoot Settings", None)}
	elif not handled:
		# Small row, no payload, no Chatwoot call.
		result = {"ok": True, "status": "Skipped", "log": new_log("Skipped", name, None, "Event not handled", None)}
	else:
		# What we keep of the request: the body only, never "key"/"cmd" (loop: no comprehensions over script locals).
		kept = {}
		for k in args:
			if k not in ["key", "cmd", "webhook_key", "internal_key", "action", "payload"]:
				kept[k] = args.get(k)
		log = frappe.get_doc({
			"doctype": "Chatwoot Sync Log",
			"direction": "Inbound",
			"event": name,
			"status": "Success",
			"chatwoot_conversation_id": conv_id,
			"method": "POST" if http else None,
			"path": "/api/method/chatwoot_webhook",
			"request": json.dumps(kept, indent=1, default=str)[:20000],
		})
		dedupe = None
		if http:
			stamp = args.get("updated_at") or args.get("created_at") or args.get("timestamp")
			if stamp:
				dedupe = "cw:" + name + ":" + str(conv_id or "") + ":" + str(stamp)
		dup = False
		if dedupe and frappe.db.exists("Chatwoot Sync Log", {"dedupe_key": dedupe}):
			dup = True
		else:
			log.dedupe_key = dedupe
			try:
				log.insert(ignore_permissions=True)
			except frappe.UniqueValidationError:
				dup = True
			except frappe.DuplicateEntryError:
				dup = True
		if dup:
			result = {"ok": True, "status": "Duplicate", "log": new_log("Duplicate", name, conv_id, "Already processed: " + str(dedupe), None)}
		else:
			note = None
			label = (s.ticket_label or "ticket").strip()
			existing = frappe.db.get_value("HD Ticket", {"chatwoot_conversation_id": str(conv_id)}, ["name", "status"], as_dict=True) if conv_id else None
			if conv_id and not existing:
				# A Helpdesk ticket already linked to this conversation (HD Ticket Chatwoot Link) and still open counts too.
				existing = frappe.db.get_value("HD Ticket", {"chatwoot_reply_conversation": str(conv_id),
					"status": ["not in", ["Resolved", "Closed", "Cancelled"]]}, ["name", "status"], as_dict=True)
			if not conv_id:
				log.status = "Skipped"
				note = "No conversation id"
			elif existing:
				# Idempotent: one ticket per conversation, whatever happens to the label.
				log.status = "Skipped"
				log.reference_ticket = existing.name
				note = "Ticket #" + str(existing.name) + " already exists (" + str(existing.status) + ")"
			elif http and isinstance(hint_labels, list) and label not in label_names(hint_labels):
				log.status = "Skipped"
				note = "No '" + label + "' label (hint)"
			else:
				# Verify by fetch: from here on only Chatwoot's own data counts.
				got = door("get_conversation", {"conversation_id": conv_id, "with_messages": True}, wkey)
				c = got.get("conversation") or {}
				if not got.get("ok"):
					log.status = "Failed"
					note = "Could not read conversation from Chatwoot (HTTP " + str(got.get("status")) + ")"
				elif label not in label_names(c.get("labels")):
					log.status = "Skipped"
					note = "No '" + label + "' label (verified in Chatwoot)"
				else:
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
					key9 = n9(sender.get("phone_number"))
					customer = None
					candidates = []
					if len(key9) == 9:
						rows = frappe.db.sql(
							"""select distinct dl.link_name from `tabContact` c
							join `tabDynamic Link` dl on dl.parent = c.name and dl.parenttype = 'Contact' and dl.link_doctype = 'Customer'
							left join `tabContact Phone` cp on cp.parent = c.name
							where right(regexp_replace(coalesce(cp.phone, ''), '[^0-9]', ''), 9) = %(k)s
								or right(regexp_replace(coalesce(c.mobile_no, ''), '[^0-9]', ''), 9) = %(k)s
								or right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', ''), 9) = %(k)s
							union
							select name from `tabCustomer` where right(regexp_replace(coalesce(mobile_no, ''), '[^0-9]', ''), 9) = %(k)s""",
							{"k": key9},
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

					# Never "Guest" and never the customer: a fixed placeholder address.
					raised_by = RAISED_BY_FALLBACK  # never the customer's email: Helpdesk could email them
					ticket = frappe.get_doc({
						"doctype": "HD Ticket",
						"subject": subject,
						"description": description,
						"raised_by": raised_by,
						"owner": "Administrator",
						"caller_name": (sender.get("name") or "").strip() or None,
						"caller_phone": caller_phone(sender.get("phone_number")),
						"erp_customer": customer,
						"source": "Chatwoot",
						"chatwoot_conversation_id": str(conv_id),
						"chatwoot_contact_id": str(sender.get("id") or "") or None,
						"chatwoot_inbox": str(c.get("inbox_id") or ""),
						"chatwoot_opted_out": 1 if opted_out else 0,
					})
					insert_error = None
					try:
						ticket.insert(ignore_permissions=True)
					except frappe.UniqueValidationError:
						ticket = None
					except frappe.DuplicateEntryError:
						ticket = None
					except Exception as e:
						insert_error = str(e)[:500]
					if insert_error:
						log.status = "Failed"
						note = "Ticket insert failed: " + insert_error
					elif ticket is None:
						# Two deliveries raced; the other one created it.
						log.status = "Duplicate"
						log.reference_ticket = frappe.db.get_value("HD Ticket", {"chatwoot_conversation_id": str(conv_id)}, "name")
						note = "Ticket already created by a parallel delivery"
					else:
						log.reference_ticket = ticket.name
						details = ["Ticket #" + str(ticket.name) + " created", "raised_by: " + raised_by]
						owner_now = frappe.db.get_value("HD Ticket", ticket.name, "owner")
						if owner_now == "Administrator":
							details.append("owner kept: Administrator")
						else:
							# Frappe overwrote it with the session user (Guest); fix it without touching modified.
							frappe.db.set_value("HD Ticket", ticket.name, {"owner": "Administrator", "modified_by": "Administrator"}, update_modified=False)
							details.append("owner was " + str(owner_now) + ", set to Administrator")
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
						link = (s.helpdesk_url or "https://portal.yool.tech").rstrip("/") + "/helpdesk/tickets/" + str(ticket.name)
						sent = door("add_private_note", {"conversation_id": conv_id, "ticket": ticket.name,
							"content": "🎫 Ticket #" + str(ticket.name) + " created: " + link}, wkey)
						details.append("Private note: " + ("sent" if sent.get("ok") else "FAILED, see " + str(sent.get("log"))))
						note = "; ".join(details)
						result["ticket"] = ticket.name

			log.response = json.dumps({"result": note}, default=str)
			if log.status == "Failed":
				log.error = note
			log.save(ignore_permissions=True)
			result["ok"] = log.status != "Failed"
			result["status"] = log.status
			result["note"] = note
			result["log"] = log.name

frappe.flags.chatwoot_webhook = result
