# Server Script — "Chatwoot Message Templates"
# Script Type: API | API Method: chatwoot_message_templates | Allow Guest: No
#
# The customer WhatsApp texts sent when a Chatwoot ticket moves to another status (Kanban column).
#   action=get   (any agent)                -> default template + one row per status
#   action=save  (Agent Manager / System Manager), payload {default_template?, rows: [{status, enabled, message}]}
#   action=pause (Agent Manager / System Manager), payload {paused: 1|0} -> stops / allows every automatic WhatsApp
#                (customers and agents; private notes still go). Each change leaves a Chatwoot Sync Log row.
# Rows live in Chatwoot Settings.status_messages; a status without a row (or with an empty message) uses the
# default template; a row with enabled=0 means "send nothing for this status".

PLACEHOLDERS = ["{name}", "{ticket}", "{subject}", "{status}"]

user = frappe.session.user
roles = frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
	"role": ["in", ["System Manager", "Agent Manager", "Agent"]]}, pluck="role")
is_admin = user == "Administrator" or "System Manager" in roles
can_edit = is_admin or "Agent Manager" in roles
if not (can_edit or "Agent" in roles):
	frappe.throw("Not permitted", frappe.PermissionError)

args = frappe.form_dict
action = args.get("action") or "get"
payload = args.get("payload") or {}
if isinstance(payload, str):
	payload = json.loads(payload) if payload.strip() else {}

s = frappe.get_doc("Chatwoot Settings")

if action == "save":
	if not can_edit:
		frappe.throw("Only Agent Managers can change customer messages.", frappe.PermissionError)
	if "default_template" in payload:
		text = str(payload.get("default_template") or "").strip()
		if not text:
			frappe.throw("The default message cannot be empty.")
		s.customer_message_template = text[:1000]
	valid = frappe.get_all("HD Ticket Status", pluck="name")
	for r in payload.get("rows") or []:
		status = str(r.get("status") or "")
		if status not in valid:
			frappe.throw("Unknown status: " + status)
		row = None
		for x in s.status_messages or []:
			if x.status == status:
				row = x
		if row is None:
			row = s.append("status_messages", {"status": status})
		row.enabled = 1 if r.get("enabled") else 0
		row.message = str(r.get("message") or "").strip()[:1000]
	s.save(ignore_permissions=True)
	s = frappe.get_doc("Chatwoot Settings")

if action == "pause":
	if not can_edit:
		frappe.throw("Only Agent Managers can pause or resume WhatsApp messages.", frappe.PermissionError)
	paused = 1 if payload.get("paused") else 0
	if (1 if s.whatsapp_paused else 0) != paused:
		s.whatsapp_paused = paused
		s.save(ignore_permissions=True)
		frappe.get_doc({"doctype": "Chatwoot Sync Log", "direction": "Outbound", "status": "Success",
			"event": "whatsapp_paused" if paused else "whatsapp_resumed",
			"error": ("Paused" if paused else "Resumed") + " by " + frappe.get_fullname(user)}).insert(ignore_permissions=True)
	s = frappe.get_doc("Chatwoot Settings")

rows = []
for x in s.status_messages or []:
	rows.append({"status": x.status, "enabled": 1 if x.enabled else 0, "message": x.message or ""})
frappe.flags.templates = {
	"default_template": s.customer_message_template or "",
	"send_customer_messages": 1 if s.send_customer_messages else 0,
	"whatsapp_paused": 1 if s.whatsapp_paused else 0,
	"enabled": 1 if s.enabled else 0,
	"can_edit": 1 if can_edit else 0,
	"placeholders": PLACEHOLDERS,
	"rows": rows,
}
