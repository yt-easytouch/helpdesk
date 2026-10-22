# Server Script — "Chatwoot API"
# Script Type: API | API Method: chatwoot_api | Allow Guest: Yes (see below)
#
# Chatwoot API: the one door from Helpdesk to Chatwoot.
#   HTTP:     POST /api/method/chatwoot_api  {action, payload}            (System Manager only)
#   Internal: run_script("Chatwoot API", action=..., payload=...) from other server scripts;
#             the result comes back in frappe.flags.chatwoot_result.
# Every Chatwoot request writes one Chatwoot Sync Log row, success or failure.
# The API token is read here only (Password field) and never returned, logged or sent to the browser.
# The webhook key (Chatwoot Settings.webhook_key) is redacted to *** in every logged request/response.
#
# Why Allow Guest = Yes: the Chatwoot webhook ("Chatwoot Webhook", chatwoot_webhook_<key>) runs as Guest and
# run_script() refuses a guest call into an allow_guest=0 script. Guest is still refused here unless ALL hold:
#   - the current HTTP request is /api/method/chatwoot_webhook_<webhook_key> (form_dict.cmd; inside the webhook),
#   - the webhook passed the same key again (webhook_key kwarg, compared with Chatwoot Settings),
#   - the action is get_conversation, list_labeled_conversations or add_private_note.
# A direct HTTP call to /api/method/chatwoot_api still needs a System Manager.
# Any other non-admin caller (the HD Ticket scripts, running as the agent who saved the ticket) must pass
# internal_key = Chatwoot Settings.internal_key, which only server scripts can read; this also closes
# /api/v2/method/chatwoot_api, where cmd is empty.
#
# Actions: test_connection, list_agents, find_contact_by_phone, get_conversation, list_labeled_conversations,
#          add_private_note, set_conversation_label, send_customer_message, ensure_conversation, setup_webhook, retry


def n9(phone):
	# The join key: digits only, no leading zeros, 252 prefix, compared on the last 9 digits.
	d = "".join([c for c in str(phone or "") if c.isdigit()]).lstrip("0")
	if not d:
		return ""
	if not d.startswith("252"):
		d = "252" + d
	return d[-9:]


def cw(ctx, method, path, body):
	# One Chatwoot request + its Sync Log row. Returns {ok, status, data, error, log}.
	url = ctx["base"] + "/api/v1/accounts/" + str(ctx["account"]) + path
	headers = {"api_access_token": ctx["token"], "Content-Type": "application/json", "Accept": "application/json"}
	res = {"ok": False, "status": 0, "data": None, "error": None, "log": None}
	started = frappe.utils.now_datetime()
	# No timeout possible: make_request() here takes no timeout argument (tested), so a hung Chatwoot can delay a save.
	try:
		if method == "GET":
			res["data"] = frappe.make_get_request(url, headers=headers)
		elif method == "PATCH":
			res["data"] = frappe.make_patch_request(url, headers=headers, data=json.dumps(body))
		elif method == "DELETE":
			res["data"] = frappe.make_delete_request(url, headers=headers)
		else:
			res["data"] = frappe.make_post_request(url, headers=headers, data=json.dumps(body))
		res["ok"] = True
		res["status"] = 200
	except Exception as e:
		code = 0
		try:
			code = e.response.status_code
		except Exception:
			code = 0
		res["status"] = code
		res["error"] = str(e)[:1000]
		# frappe.make_*_request writes its own Error Log on failure, with the local variables (our headers = the
		# token). Mask every secret in Error Log rows of the last 5 minutes. SELECT + set_value only; never printed.
		since = frappe.utils.add_to_date(frappe.utils.now_datetime(), minutes=-5)
		for sec in [ctx["token"]] + (ctx.get("secrets") or []):
			if sec and len(str(sec)) >= 16:
				rows = frappe.db.sql("select name, method, error from `tabError Log` where creation > %(t)s and "
					"(error like %(p)s or method like %(p)s)", {"t": since, "p": "%" + str(sec) + "%"}, as_dict=True)
				for row in rows:
					err = row.error or ""
					meth = row.method or ""
					for other in [ctx["token"]] + (ctx.get("secrets") or []):
						if other and len(str(other)) >= 16:
							err = err.replace(str(other), "***")
							meth = meth.replace(str(other), "***")
					frappe.db.set_value("Error Log", row.name, {"error": err, "method": meth}, update_modified=False)
	took = int((frappe.utils.now_datetime() - started).total_seconds() * 1000)
	text = res["data"] if isinstance(res["data"], str) else json.dumps(res["data"], default=str)
	reqtext = json.dumps({"action": ctx["action"], "payload": ctx["payload"], "body": body}, indent=1, default=str)
	# Redaction: known secrets, then whatever follows "chatwoot_webhook_" / "chatwoot_webhook?key=" in a URL
	# (also old keys Chatwoot still has).
	clean = []
	for t in [reqtext, text or "", res["error"] or ""]:
		for sec in ctx.get("secrets") or []:
			if sec:
				t = t.replace(sec, "***")
		for marker in ["chatwoot_webhook_", "chatwoot_webhook?key="]:
			parts = t.split(marker)
			out = parts[0]
			for p in parts[1:]:
				i = 0
				while i < len(p) and (p[i].isalnum() or p[i] in "-_%"):
					i = i + 1
				out = out + marker + "***" + p[i:]
			t = out
		clean.append(t)
	reqtext = clean[0]
	text = clean[1]
	res["error"] = clean[2] or None
	log = frappe.get_doc({
		"doctype": "Chatwoot Sync Log",
		"direction": "Outbound",
		"event": ctx["action"],
		"status": "Success" if res["ok"] else "Failed",
		"http_status": res["status"],
		"reference_ticket": ctx.get("ticket"),
		"chatwoot_conversation_id": ctx.get("conversation_id"),
		"retry_of": ctx.get("retry_of"),
		"duration_ms": took,
		"method": method,
		"path": path,
		"request": reqtext,
		"response": (text or "")[:20000],
		"error": res["error"],
	}).insert(ignore_permissions=True)
	res["log"] = log.name
	return res


def intl(phone):
	# Full international digits for WhatsApp: Somali numbers -> 252XXXXXXXXX; other countries when they carry a
	# country code (+44 7..., 0044..., or 11-15 digits not starting with 0, e.g. 447...). "" when unusable.
	# 2026-10-19 (user-approved): explicit +/00 numbers accept the full E.164 range, 8-15 digits, same as
	# the HD Ticket Caller Validation rule. Bare 9 digits stay Somali.
	raw = str(phone or "").strip()
	d = "".join([c for c in raw if c.isdigit()])
	if d.startswith("00"):
		d = d[2:]
	if len(d) == 9 and not d.startswith("0"):
		return "252" + d
	if len(d) == 10 and d.startswith("0"):
		return "252" + d[1:]
	if len(d) == 12 and d.startswith("252") and d[3] != "0":
		return d
	if (raw.startswith("+") or raw.startswith("00") or len(d) >= 11) and 8 <= len(d) <= 15 and not d.startswith("252") and not d.startswith("0"):
		return d
	return ""


def strict_phone(phone):
	# A real Somali mobile only: 9 digits, 0 + 9 digits, or 252 + 9 digits (optionally with +/spaces/dashes).
	d = "".join([c for c in str(phone or "") if c.isdigit()])
	if len(d) == 12 and d.startswith("252"):
		d = d[3:]
	elif len(d) == 10 and d.startswith("0"):
		d = d[1:]
	return len(d) == 9 and not d.startswith("0")


def skip_log(action, payload, reason):
	return frappe.get_doc({
		"doctype": "Chatwoot Sync Log",
		"direction": "Outbound",
		"event": action,
		"status": "Skipped",
		"reference_ticket": payload.get("ticket"),
		"chatwoot_conversation_id": payload.get("conversation_id"),
		"request": json.dumps({"action": action, "payload": payload}, indent=1, default=str),
		"error": reason,
	}).insert(ignore_permissions=True).name


args = frappe.form_dict
action = args.get("action") or ""
payload = args.get("payload") or {}
if isinstance(payload, str):
	payload = json.loads(payload) if payload.strip() else {}

user = frappe.session.user
admin = user == "Administrator" or bool(frappe.get_all(
	"Has Role", filters={"parent": user, "parenttype": "User", "role": "System Manager"}, pluck="role"))
agent = admin or bool(frappe.get_all(
	"Has Role", filters={"parent": user, "parenttype": "User", "role": ["in", ["Agent", "Agent Manager"]]}, pluck="role"))
# Called over HTTP (not through run_script from another server script): admins only.
# frappe.request does not exist in safe_exec. form_dict.cmd is the /api/method/<cmd> that is really running
# (a body "cmd" re-routes the request to that method, so it cannot point at another script) and it stays
# set inside run_script(). /api/v2/method/... leaves cmd empty: see the Guest rule below.
cmd = str(args.get("cmd") or "")
external = cmd == "chatwoot_api"
s = frappe.get_doc("Chatwoot Settings")
if user == "Guest":
	# Only from inside the webhook (after its key check), only the read/note actions, and only with the key again.
	wkey = s.get_password("webhook_key", raise_exception=False) or ""
	given = str(args.get("webhook_key") or "")
	if (len(wkey) < 32 or cmd != "chatwoot_webhook_" + wkey or given != wkey
			or action not in ["get_conversation", "list_labeled_conversations", "add_private_note"]):
		frappe.throw("Not permitted", frappe.PermissionError)
elif not admin:
	ikey = s.get_password("internal_key", raise_exception=False) or ""
	if external or not agent or len(ikey) < 32 or str(args.get("internal_key") or "") != ikey:
		frappe.throw("Not permitted", frappe.PermissionError)
if action == "setup_webhook" and not admin:
	frappe.throw("Not permitted", frappe.PermissionError)

retry_of = None
if action == "retry":
	if not admin:
		frappe.throw("Not permitted", frappe.PermissionError)
	src = frappe.get_doc("Chatwoot Sync Log", payload.get("log"))
	if src.direction != "Outbound" or src.status not in ["Failed", "Skipped"]:
		frappe.throw("Only failed or skipped outbound rows can be retried.")
	req = json.loads(src.request or "{}")
	action = req.get("action") or ""
	payload = req.get("payload") or {}
	retry_of = src.name

# Test mode: while Chatwoot Settings "Test numbers" has numbers, customer messages go only to them.
test_keys = []
for x in (s.test_numbers or "").replace(",", "\n").split("\n"):
	if x.strip():
		test_keys.append(n9(x))

result = None
if action not in ["test_connection", "list_agents", "find_contact_by_phone", "get_conversation", "add_private_note",
		"set_conversation_label", "send_customer_message", "list_labeled_conversations", "setup_webhook", "ensure_conversation",
		"send_agent_message"]:
	frappe.throw("Unknown action: " + str(action))

if not s.enabled and action not in ["test_connection", "list_agents", "setup_webhook"]:
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Integration is disabled in Chatwoot Settings")}
elif action in ["send_customer_message", "send_agent_message"] and s.whatsapp_paused:
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "WhatsApp messages are paused (Kanban switch)")}
elif action == "send_agent_message" and not s.notify_agents:
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Agent notifications are off in Chatwoot Settings")}
elif action == "send_agent_message" and not intl(payload.get("phone")):
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Agent has no valid phone (User mobile / Employee cell / User phone)")}
elif action == "send_agent_message" and frappe.db.count("Chatwoot Sync Log", {"event": ["in", ["send_customer_message", "send_agent_message"]],
		"status": "Success", "creation": [">", frappe.utils.add_to_date(frappe.utils.now_datetime(), seconds=-60)]}) >= (s.max_messages_per_minute or 20):
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Rate limit: too many messages this minute (retry later)")}
elif action == "send_customer_message" and not s.send_customer_messages:
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Customer-facing messages are off in Chatwoot Settings")}
elif action == "send_customer_message" and payload.get("ticket") and frappe.db.get_value("HD Ticket", payload.get("ticket"), "chatwoot_opted_out"):
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Customer opted out (JOOJI)")}
elif action == "send_customer_message" and not intl(payload.get("phone")):
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "No valid phone for this customer")}
elif action == "send_customer_message" and test_keys and n9(payload.get("phone")) not in test_keys:
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Test mode: number is not in Test numbers")}
elif action == "send_customer_message" and frappe.db.count("Chatwoot Sync Log", {"event": "send_customer_message", "status": "Success",
		"creation": [">", frappe.utils.add_to_date(frappe.utils.now_datetime(), seconds=-60)]}) >= (s.max_messages_per_minute or 20):
	result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Rate limit: too many customer messages this minute (retry later)")}
else:
	token = s.get_password("api_token", raise_exception=False)
	if not token or not s.base_url or not s.account_id:
		result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Base URL, Account ID or API token is missing")}
	else:
		ctx = {"base": s.base_url.rstrip("/"), "account": s.account_id, "token": token, "action": action,
			"payload": payload, "ticket": payload.get("ticket"), "conversation_id": payload.get("conversation_id"),
			"retry_of": retry_of, "secrets": [token, s.get_password("webhook_key", raise_exception=False),
				s.get_password("internal_key", raise_exception=False)]}

		if action == "test_connection":
			r = cw(ctx, "GET", "/inboxes", None)
			boxes = []
			if r["ok"]:
				boxes = [{"id": b.get("id"), "name": b.get("name"), "type": b.get("channel_type")} for b in (r["data"] or {}).get("payload") or []]
			result = {"ok": r["ok"], "status": r["status"], "error": r["error"], "inboxes": boxes, "log": r["log"]}

		elif action == "list_agents":
			r = cw(ctx, "GET", "/agents", None)
			rows = []
			if r["ok"]:
				hd = frappe.get_all("HD Agent", fields=["name", "user", "agent_name"])
				for a in r["data"] or []:
					email = (a.get("email") or "").lower()
					match = None
					for h in hd:
						if (h.user or h.name or "").lower() == email:
							match = h.name
					rows.append({"chatwoot_agent_id": a.get("id"), "chatwoot_name": a.get("name"), "chatwoot_email": a.get("email"),
						"hd_agent": match})
			result = {"ok": r["ok"], "status": r["status"], "error": r["error"], "agents": rows, "log": r["log"]}

		elif action == "find_contact_by_phone":
			key = n9(payload.get("phone"))
			if len(key) != 9:
				frappe.throw("Phone number must have at least 9 digits")
			found = []
			verified = False
			cached = payload.get("contact_id")
			if cached:
				# Cached IDs are verified before use; a 404 or a different phone means search again.
				r = cw(ctx, "GET", "/contacts/" + str(int(cached)), None)
				c = ((r["data"] or {}).get("payload") or {}) if r["ok"] else {}
				if r["ok"] and n9(c.get("phone_number")) == key:
					found = [{"id": c.get("id"), "name": c.get("name"), "phone_number": c.get("phone_number")}]
					verified = True
			if not found:
				r = cw(ctx, "GET", "/contacts/search?include_contacts=true&q=" + key, None)
				for c in ((r["data"] or {}).get("payload") or []) if r["ok"] else []:
					if n9(c.get("phone_number")) == key:
						found.append({"id": c.get("id"), "name": c.get("name"), "phone_number": c.get("phone_number")})
			result = {"ok": r["ok"], "key": key, "cache_verified": verified, "contacts": found, "log": r["log"]}

		elif action == "get_conversation":
			cid = int(payload.get("conversation_id") or 0)
			r = cw(ctx, "GET", "/conversations/" + str(cid), None)
			out = {"ok": r["ok"], "status": r["status"], "error": r["error"], "conversation": r["data"] if r["ok"] else None, "log": r["log"]}
			if r["ok"] and payload.get("with_messages"):
				m = cw(ctx, "GET", "/conversations/" + str(cid) + "/messages", None)
				out["messages"] = ((m["data"] or {}).get("payload") or []) if m["ok"] else []
			result = out

		elif action == "add_private_note":
			cid = int(payload.get("conversation_id") or 0)
			content = str(payload.get("content") or "").strip()
			if not cid or not content:
				frappe.throw("conversation_id and content are required")
			# Always private: this door never sends a customer-facing message.
			r = cw(ctx, "POST", "/conversations/" + str(cid) + "/messages",
				{"content": content, "message_type": "outgoing", "private": True})
			result = {"ok": r["ok"], "status": r["status"], "error": r["error"],
				"message_id": (r["data"] or {}).get("id") if r["ok"] else None, "log": r["log"]}

		elif action == "send_customer_message":
			# Customer-facing (goes out on the conversation's channel, e.g. WhatsApp). Only when the
			# setting is on and the customer has not opted out (checked above).
			cid = int(payload.get("conversation_id") or 0)
			content = str(payload.get("content") or "").strip()
			if not cid or not content:
				frappe.throw("conversation_id and content are required")
			# Re-check against Chatwoot itself (payload.phone is only what the ticket says): one GET of the
			# conversation's messages; its meta.contact is the real recipient.
			m = cw(ctx, "GET", "/conversations/" + str(cid) + "/messages", None)
			mdata = (m["data"] or {}) if m["ok"] else {}
			contact = (mdata.get("meta") or {}).get("contact") or {}
			# Real recipient (user-approved 2026-10-19): a Somali mobile OR any full international E.164
			# number — intl() decides (Somali 9 / 0+9 / 252+12 shapes, or +/00 with 8-15 digits). No slicing
			# of longer numbers. "real" keeps the last-9-digit key for the Test numbers compare below.
			full_real = intl(contact.get("phone_number"))
			real = n9(full_real) if full_real else ""
			opted = (contact.get("custom_attributes") or {}).get("opted_out") in [True, 1, "1", "true", "yes"]
			for msg in mdata.get("payload") or []:
				if msg.get("message_type") in [0, "incoming"] and str(msg.get("content") or "").strip().upper() == "JOOJI":
					opted = True
			if not m["ok"]:
				result = {"ok": False, "skipped": True, "log": skip_log(action, payload,
					"Could not read the conversation to check the recipient (HTTP " + str(m["status"]) + ")")}
			elif opted:
				if payload.get("ticket") and frappe.db.exists("HD Ticket", payload.get("ticket")):
					frappe.db.set_value("HD Ticket", payload.get("ticket"), "chatwoot_opted_out", 1, update_modified=False)
				result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "opted out (JOOJI)")}
			elif not real:
				result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Conversation contact has no valid phone number")}
			elif test_keys and real not in test_keys:
				result = {"ok": False, "skipped": True, "log": skip_log(action, payload, "Test mode: conversation contact is not in Test numbers")}
			else:
				r = cw(ctx, "POST", "/conversations/" + str(cid) + "/messages",
					{"content": content, "message_type": "outgoing", "private": False})
				result = {"ok": r["ok"], "status": r["status"], "error": r["error"],
					"message_id": (r["data"] or {}).get("id") if r["ok"] else None, "log": r["log"]}

		elif action == "ensure_conversation":
			# Find (or create) the customer's WhatsApp conversation in the default inbox, keyed like the
			# sadarsms channel does: source_id = 252XXXXXXXXX@s.whatsapp.net. Creating one sends nothing.
			full = intl(payload.get("phone"))
			inbox = int(payload.get("inbox_id") or s.default_inbox_id or 0)
			if not full or not inbox:
				frappe.throw("A valid phone number and an inbox are required")
			key = full[-9:]
			jid = full + "@s.whatsapp.net"
			found = cw(ctx, "GET", "/contacts/search?include_contacts=true&q=" + key, None)
			contact = None
			for c in ((found["data"] or {}).get("payload") or []) if found["ok"] else []:
				if intl(c.get("phone_number")) == full:
					has_inbox = False
					for ci in c.get("contact_inboxes") or []:
						if (ci.get("inbox") or {}).get("id") == inbox:
							has_inbox = True
					if contact is None or has_inbox:
						contact = {"id": c.get("id"), "has_inbox": has_inbox}
			created = []
			if contact is None and found["ok"]:
				newc = {"name": str(payload.get("name") or ("+" + full)), "phone_number": "+" + full}
				if payload.get("company"):
					newc["additional_attributes"] = {"company_name": str(payload.get("company"))}
				r = cw(ctx, "POST", "/contacts", newc)
				cid_new = ((r["data"] or {}).get("payload") or {}).get("contact") or ((r["data"] or {}).get("payload") or {})
				if r["ok"] and cid_new.get("id"):
					contact = {"id": cid_new.get("id"), "has_inbox": False}
					created.append("contact")
			result = {"ok": False, "log": found["log"]}
			if contact:
				if not contact["has_inbox"]:
					r = cw(ctx, "POST", "/contacts/" + str(contact["id"]) + "/contact_inboxes", {"inbox_id": inbox, "source_id": jid})
					if r["ok"]:
						created.append("contact_inbox")
				conv = None
				r = cw(ctx, "GET", "/contacts/" + str(contact["id"]) + "/conversations", None)
				best = 0
				for c in ((r["data"] or {}).get("payload") or []) if r["ok"] else []:
					if c.get("inbox_id") == inbox and (payload.get("any_status") or c.get("status") in ["open", "pending", "snoozed"]) and (c.get("last_activity_at") or 0) >= best:
						best = c.get("last_activity_at") or 0
						conv = c.get("id")
				if conv is None:
					r = cw(ctx, "POST", "/conversations", {"source_id": jid, "inbox_id": inbox, "contact_id": contact["id"], "status": "open"})
					conv = (r["data"] or {}).get("id") if r["ok"] else None
					if conv:
						created.append("conversation")
				result = {"ok": bool(conv), "conversation_id": conv, "contact_id": contact["id"], "created": created,
					"new_conversation": "conversation" in created, "log": r["log"]}

		elif action == "send_agent_message":
			# Staff WhatsApp (assignment brief). One conversation per agent in the default inbox is reused and left
			# resolved afterwards, so staff messages do not crowd the agents' Open list.
			got = (run_script("Chatwoot API", action="ensure_conversation", internal_key=s.get_password("internal_key", raise_exception=False),
				payload={"phone": payload.get("phone"), "name": payload.get("name"), "ticket": payload.get("ticket"), "any_status": 1}) or {}).get("chatwoot_result") or {}
			cid = got.get("conversation_id")
			if not cid:
				result = {"ok": False, "error": "No conversation for the agent", "log": got.get("log")}
			else:
				ctx["conversation_id"] = cid
				r = cw(ctx, "POST", "/conversations/" + str(cid) + "/messages",
					{"content": str(payload.get("content") or "").strip(), "message_type": "outgoing", "private": False})
				if r["ok"]:
					cw(ctx, "POST", "/conversations/" + str(cid) + "/toggle_status", {"status": "resolved"})
				result = {"ok": r["ok"], "status": r["status"], "error": r["error"], "conversation_id": cid, "log": r["log"]}

		elif action == "set_conversation_label":
			cid = int(payload.get("conversation_id") or 0)
			add = [str(x) for x in (payload.get("add") or [])]
			remove = [str(x) for x in (payload.get("remove") or [])]
			g = cw(ctx, "GET", "/conversations/" + str(cid) + "/labels", None)
			if not g["ok"]:
				result = {"ok": False, "status": g["status"], "error": g["error"], "log": g["log"]}
			else:
				# Loops, not comprehensions: script-level names are not visible inside a comprehension here.
				labels = []
				for x in (g["data"] or {}).get("payload") or []:
					if x not in remove:
						labels.append(x)
				for x in add:
					if x not in labels:
						labels.append(x)
				r = cw(ctx, "POST", "/conversations/" + str(cid) + "/labels", {"labels": labels})
				result = {"ok": r["ok"], "status": r["status"], "error": r["error"], "labels": labels, "log": r["log"]}

		elif action == "list_labeled_conversations":
			# Open conversations carrying the ticket label -> display ids (25 per page, max 20 pages).
			raw = str(s.ticket_label or "ticket").strip()
			label = ""
			for ch in raw:
				if ch.isalnum() or ch in "-_":
					label = label + ch
			ids = []
			page = 1
			r = {"ok": True, "status": 0, "error": None, "log": None}
			while page <= 20:
				r = cw(ctx, "GET", "/conversations?status=open&assignee_type=all&labels%5B%5D=" + label + "&page=" + str(page), None)
				if not r["ok"]:
					break
				rows = ((r["data"] or {}).get("data") or {}).get("payload") or []
				for c in rows:
					if c.get("id") and c.get("id") not in ids:
						ids.append(c.get("id"))
				if len(rows) < 25:
					break
				page = page + 1
			result = {"ok": r["ok"], "status": r["status"], "error": r["error"], "ids": ids, "pages": page, "log": r["log"]}

		elif action == "setup_webhook":
			# Our ONE account webhook (inbox_id empty) -> <helpdesk_url>/api/method/chatwoot_webhook_<webhook_key>.
			# The key is the method name: Frappe drops ?query args when the body is JSON, and safe_exec cannot read headers.
			# payload.active false: delete only the webhook whose id we stored. Inbox webhooks are never touched.
			# The key and the URL are never returned or logged (cw() redacts them).
			# Order: (1) Chatwoot accepts the new URL, (2) Server Script "Chatwoot Webhook".api_method, (3) Settings.
			# If (2)/(3) fail, Chatwoot is pointed back at the old URL, so the live state stays consistent.
			# Prefer helpdesk_url (portal.yool.tech); else the site URL; only our two hosts are accepted.
			site = str(s.helpdesk_url or "").strip().rstrip("/")
			if site not in ["https://my.yool.tech", "https://portal.yool.tech"]:
				try:
					site = str(frappe.utils.get_url() or "").rstrip("/")
				except Exception:
					site = ""
			if site not in ["https://my.yool.tech", "https://portal.yool.tech"]:
				site = "https://my.yool.tech"
			hook_id = str(s.chatwoot_webhook_id or "").strip()
			subs = ["conversation_updated", "conversation_created", "conversation_status_changed"]
			prefix = site + "/api/method/chatwoot_webhook_"
			if payload.get("active") in [False, 0, "0", "false", "False"]:
				if not hook_id:
					result = {"ok": True, "active": False, "note": "No stored webhook id; nothing deleted"}
				else:
					r = cw(ctx, "DELETE", "/webhooks/" + str(int(hook_id)), None)
					if r["ok"] or r["status"] == 404:
						frappe.db.set_value("Chatwoot Settings", "Chatwoot Settings", "chatwoot_webhook_id", "")
					result = {"ok": r["ok"] or r["status"] == 404, "status": r["status"], "error": r["error"],
						"active": False, "webhook_id": None, "log": r["log"]}
			else:
				# Fail early, before touching Chatwoot, if the webhook script cannot be read.
				script = frappe.get_doc("Server Script", "Chatwoot Webhook")
				old_key = s.get_password("webhook_key", raise_exception=False) or ""
				key = old_key
				rotated = False
				if len(key) < 48 or payload.get("rotate"):
					key = frappe.utils.generate_hash(length=56)
					if len(key) < 48:
						key = key + frappe.utils.generate_hash(length=56)
					rotated = True
				ctx["secrets"] = ctx["secrets"] + [key, old_key]
				body = {"url": prefix + key, "subscriptions": subs}
				if not hook_id:
					# Adopt an existing account webhook of ours (old or new URL form) instead of a 422 "url taken".
					g = cw(ctx, "GET", "/webhooks", None)
					hooks = (((g["data"] or {}).get("payload") or {}).get("webhooks") or []) if g["ok"] else []
					for h in hooks:
						if not h.get("inbox_id") and str(h.get("url") or "").startswith(site + "/api/method/chatwoot_webhook"):
							hook_id = str(h.get("id"))
				r = None
				if hook_id:
					r = cw(ctx, "PATCH", "/webhooks/" + str(int(hook_id)), body)
					if not r["ok"] and r["status"] == 404:
						hook_id = ""
				if not hook_id:
					r = cw(ctx, "POST", "/webhooks", body)
					if r["ok"]:
						d = r["data"] or {}
						w = (d.get("payload") or {}).get("webhook") or d.get("payload") or d
						hook_id = str(w.get("id") or "")
				note = None
				ok = bool(r["ok"] and hook_id)
				if ok:
					try:
						if script.api_method != "chatwoot_webhook_" + key:
							script.api_method = "chatwoot_webhook_" + key
							script.save(ignore_permissions=True)
						s.webhook_key = key
						s.chatwoot_webhook_id = hook_id
						s.save(ignore_permissions=True)
					except Exception as e:
						# Point Chatwoot back at the old URL, then throw: the whole request (api_method, settings,
						# log rows) rolls back, so Frappe and Chatwoot never disagree about the key.
						note = "Saving the new key failed: " + str(e)[:300]
						if old_key and rotated:
							back = cw(ctx, "PATCH", "/webhooks/" + str(int(hook_id)), {"url": prefix + old_key, "subscriptions": subs})
							note = note + ("; Chatwoot pointed back to the old URL" if back["ok"] else "; revert FAILED, run setup_webhook again")
						elif not old_key:
							note = note + "; Chatwoot now calls a method that does not exist, run setup_webhook again"
						for sec in [key, old_key]:
							if sec:
								note = note.replace(sec, "***")
						frappe.throw(note)
				result = {"ok": ok, "status": r["status"], "error": r["error"], "note": note, "active": True,
					"webhook_id": hook_id or None, "url": prefix + "***", "subscriptions": subs,
					"rotated": rotated, "log": r["log"]}

# API scripts return their frappe.flags: HTTP callers get {"message": {"chatwoot_result": ...}}.
frappe.flags.chatwoot_result = result
