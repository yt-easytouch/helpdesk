# Server Script — "HD Ticket Time Spent"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: Before Save
#
# time_spent is a Data field holding "h:mm" (e.g. "1:30"). Whatever an agent types is normalized to h:mm:
#   "1:30" -> 1:30, "1h 30m" / "1h" / "45m" / "1.5h" / "90 min" -> as written, a plain number -> minutes.
# Empty or zero -> empty.
# Invalid text is rejected with a plain-text message (Helpdesk toasts show HTML literally).
# Separate from "HD Ticket Caller Validation" on purpose; touches only time_spent.

value = doc.time_spent
if value is None or value == "":
    doc.time_spent = None
elif isinstance(value, (int, float)):
    # A raw number from the API = minutes.
    value = str(value)
if value is not None and value != "":
    text = str(value).strip().lower().replace(" ", "")
    seconds = None
    if text == "" or text == "0":
        seconds = 0
    elif ":" in text:
        parts = text.split(":")
        if len(parts) in (2, 3) and parts[0].isdigit() and parts[1].isdigit():
            seconds = int(parts[0]) * 3600 + int(parts[1]) * 60
            if len(parts) == 3 and parts[2].isdigit():
                seconds = seconds + int(parts[2])
            elif len(parts) == 3:
                seconds = None
    elif "h" in text or "m" in text:
        hours_part = "0"
        minutes_part = "0"
        rest = text.replace("hrs", "h").replace("hr", "h").replace("min", "m")
        if "h" in rest:
            hours_part = rest.split("h")[0] or "0"
            rest = rest.split("h", 1)[1]
        if "m" in rest:
            minutes_part = rest.split("m")[0] or "0"
            rest = rest.split("m", 1)[1]
        ok = rest == "" and hours_part.replace(".", "", 1).isdigit() and minutes_part.isdigit()
        if ok:
            seconds = int(round(float(hours_part) * 3600)) + int(minutes_part) * 60
    elif text.replace(".", "", 1).isdigit():
        seconds = int(round(float(text) * 60))
    if seconds is None:
        frappe.throw(
            "Time Spent sax ma aha. Tusaale: 1:30, 1h 30m ama 45 (daqiiqo).  /  "
            "Invalid Time Spent. Example: 1:30, 1h 30m or 45 (minutes).",
            title="Invalid Time Spent",
        )
    if seconds > 0:
        minutes = int(round(seconds / 60.0))
        mm = str(minutes % 60)
        if len(mm) < 2:
            mm = "0" + mm
        doc.time_spent = str(int(minutes // 60)) + ":" + mm
    else:
        doc.time_spent = None
