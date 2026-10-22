# Server Script — "Chatwoot Poll"
# Script Type: Scheduler Event | Event Frequency: Cron | Cron Format: */10 * * * *
#
# Safety net for missed webhooks: every 10 minutes, list open Chatwoot conversations with the ticket label
# (through the door) and, for each one without a ticket, run the webhook's own ticket logic in poll mode:
#   run_script("Chatwoot Webhook", conversation_id=..., source="poll")
# One Inbound Chatwoot Sync Log row per run (event "poll", counts). Does nothing while the integration is off,
# except masking secrets in Error Log (see below).

MAX_PER_RUN = 20  # new tickets attempted per run; the rest wait for the next run

s = frappe.get_doc("Chatwoot Settings")

# Error Log hygiene (runs even while disabled): frappe.make_*_request logs failures with local variables, which
# can contain the API token or our keys. Mask them in Error Log rows of the last 30 days (modify, never delete).
secrets = []
for f in ["api_token", "webhook_key", "internal_key"]:
	v = s.get_password(f, raise_exception=False)
	if v and len(v) >= 16:
		secrets.append(v)
since = frappe.utils.add_to_date(frappe.utils.now_datetime(), days=-30)
scrubbed = 0
for sec in secrets:
	rows = frappe.db.sql("select name, method, error from `tabError Log` where creation > %(t)s and "
		"(error like %(p)s or method like %(p)s)", {"t": since, "p": "%" + sec + "%"}, as_dict=True)
	for row in rows:
		err = row.error or ""
		meth = row.method or ""
		for other in secrets:
			err = err.replace(other, "***")
			meth = meth.replace(other, "***")
		frappe.db.set_value("Error Log", row.name, {"error": err, "method": meth}, update_modified=False)
		scrubbed = scrubbed + 1

if s.enabled:
	started = frappe.utils.now_datetime()
	found = 0
	existing = 0
	created = 0
	skipped = 0
	failed = 0
	errors = []
	ok = True
	lst = (run_script("Chatwoot API", action="list_labeled_conversations", payload={}) or {}).get("chatwoot_result") or {}
	if not lst.get("ok"):
		ok = False
		errors.append("list_labeled_conversations failed (HTTP " + str(lst.get("status")) + "), see " + str(lst.get("log")))
	ids = lst.get("ids") or []
	found = len(ids)
	tried = 0
	for cid in ids:
		if frappe.db.exists("HD Ticket", {"chatwoot_conversation_id": str(cid)}) or frappe.db.exists("HD Ticket", {
				"chatwoot_reply_conversation": str(cid), "status": ["not in", ["Resolved", "Closed", "Cancelled"]]}):
			existing = existing + 1
			continue
		if tried >= MAX_PER_RUN:
			break
		tried = tried + 1
		try:
			res = (run_script("Chatwoot Webhook", conversation_id=cid, source="poll") or {}).get("chatwoot_webhook") or {}
			if res.get("ticket"):
				created = created + 1
			elif res.get("status") == "Failed":
				failed = failed + 1
				errors.append("#" + str(cid) + ": " + str(res.get("note"))[:200])
			else:
				skipped = skipped + 1
		except Exception as e:
			failed = failed + 1
			errors.append("#" + str(cid) + ": " + str(e)[:200])
	counts = {"found": found, "existing": existing, "created": created, "skipped": skipped, "failed": failed,
		"error_logs_masked": scrubbed}
	frappe.get_doc({
		"doctype": "Chatwoot Sync Log",
		"direction": "Inbound",
		"event": "poll",
		"status": "Failed" if (not ok or failed) else "Success",
		"duration_ms": int((frappe.utils.now_datetime() - started).total_seconds() * 1000),
		"response": json.dumps(counts),
		"error": "\n".join(errors)[:2000] or None,
	}).insert(ignore_permissions=True)
