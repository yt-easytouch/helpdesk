# Server Script — "Chatwoot Settings Team Numbers"
# Script Type: DocType Event | Reference Doctype: Chatwoot Settings | Event: Before Save
#
# Sales-alert team numbers (Custom Fields on Chatwoot Settings; edited in the Kanban "⚙ Team numbers / Numbarrada
# kooxaha" modal by Agent Manager / System Manager, or here in the Desk form):
#   sales_alert_tech_phone  "Numberka Kooxda Technical (WhatsApp)" - receives the "HD Ticket Sales Alert" brief
#   sales_alert_sales_phone "Numberka Kooxda Sales"                - shown inside that brief
# Same rule as "HD Ticket Caller Validation": Somali formats -> +252XXXXXXXXX; any other full international number
# (+ / 00 country code, 8-15 digits) -> +<digits>; empty is allowed (empty Technical number = no alert);
# anything else is rejected.


def team_phone(raw, label):
	raw = str(raw or "").strip()
	if not raw:
		return ""
	cleaned = "".join([c for c in raw if c not in " -.()"])
	if cleaned.startswith("+"):
		digits = cleaned[1:]
	elif cleaned.startswith("00"):
		digits = cleaned[2:]
	else:
		digits = cleaned
	local = ""
	if digits.startswith("252") and len(digits) == 12:
		local = digits[3:]
	elif digits.startswith("0") and len(digits) == 10:
		local = digits[1:]
	elif len(digits) == 9:
		local = digits
	if digits.isdigit() and len(local) == 9 and local.isdigit() and local[0] != "0":
		return "+252" + local
	if (cleaned.startswith("+") or cleaned.startswith("00")) and digits.isdigit() and 8 <= len(digits) <= 15 and digits[0] != "0":
		return "+" + digits
	frappe.throw(
		label + ": geli number Soomaali ah (06.../+252...) ama mid caalami ah (+country code).  /  "
		+ label + ": enter a Somali number or a full international number (+country code).",
		title="Invalid team number",
	)


doc.sales_alert_tech_phone = team_phone(doc.get("sales_alert_tech_phone"), "Numberka Kooxda Technical (WhatsApp)")
doc.sales_alert_sales_phone = team_phone(doc.get("sales_alert_sales_phone"), "Numberka Kooxda Sales")
