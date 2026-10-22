# Server Script — "Chatwoot Webhook Old URL"
# Script Type: API | API Method: chatwoot_webhook | Allow Guest: Yes
#
# Decoy on the old, keyless URL /api/method/chatwoot_webhook. The real webhook lives at
# /api/method/chatwoot_webhook_<key> (Server Script "Chatwoot Webhook"). This only records the attempt as a
# Rejected Inbound Sync Log row (no body, no query, no cmd) and returns. Never calls Chatwoot.
# Logging is rate limited: at most one Rejected Inbound row per minute (shared with the real webhook).

since = frappe.utils.add_to_date(frappe.utils.now_datetime(), seconds=-60)
if not frappe.db.exists("Chatwoot Sync Log", {"direction": "Inbound", "status": "Rejected", "creation": [">", since]}):
	frappe.get_doc({
		"doctype": "Chatwoot Sync Log",
		"direction": "Inbound",
		"event": str(frappe.form_dict.get("event") or "unknown")[:140],
		"status": "Rejected",
		"method": "POST",
		"path": "/api/method/chatwoot_webhook",
		"error": "old/keyless URL",
	}).insert(ignore_permissions=True)
frappe.flags.chatwoot_webhook = {"ok": False, "rejected": True}
