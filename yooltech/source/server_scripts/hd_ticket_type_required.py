# Server Script: "HD Ticket Type Required"
# Script Type: DocType Event | Reference DocType: HD Ticket | Event: Before Save
# Created 2026-10-18 on my.yool.tech. Enabled.
#
# Require a real ticket type before a ticket is resolved/closed.
# Fires only when status CHANGES to a Resolved-category status on an existing
# ticket, so Chatwoot/portal/agent ticket creation is never blocked.
# "Cancelled" is excluded on purpose (it is Resolved-category on this site,
# but junk/cancelled tickets should not demand a type) — remove that clause
# if cancelled tickets must also carry a type.
# --- Multiple ticket types (added 2026-10-19) ---------------------------------------------
# Custom Field HD Ticket.ticket_types (Table MultiSelect -> child doctype "HD Ticket Type Item",
# Link ticket_type) holds every type an agent picked; the FIRST row is the primary type and is
# always mirrored into the standard Link field ticket_type, which reports, totals, SLA and the
# guard below keep using (extra types are shown, never counted separately).
# This block runs BEFORE the guard, so the guard sees the synced primary.
#   - ticket_types changed (or ticket_type did not): ticket_type = first row.
#   - only ticket_type changed (old tickets, Helpdesk sidebar, other APIs): it becomes the first
#     row, replacing the previous primary; extra rows are kept.
#   - empty / "Unspecified" primary with no rows: the table stays empty.
# Rows are de-duplicated and "Unspecified" is never stored as a row.
def clean_types(values):
    out = []
    for v in values:
        if v and v != "Unspecified" and v not in out:
            out.append(v)
    return out

raw_rows = [r.ticket_type for r in (doc.get("ticket_types") or [])]
rows_now = clean_types(raw_rows)
prev = None if doc.is_new() else doc.get_doc_before_save()
prev_type = (prev.ticket_type if prev else "") or ""
prev_rows = clean_types([r.ticket_type for r in (prev.get("ticket_types") or [])]) if prev else []
cur_type = doc.ticket_type or ""
type_changed = cur_type != prev_type
rows_changed = rows_now != prev_rows
if rows_now and (rows_changed or not type_changed):
    if cur_type != rows_now[0]:
        doc.ticket_type = rows_now[0]
    new_rows = rows_now
elif cur_type and cur_type != "Unspecified":
    new_rows = clean_types([cur_type] + [x for x in rows_now if x != prev_type])
else:
    new_rows = []
if new_rows != raw_rows:
    doc.set("ticket_types", [{"ticket_type": x} for x in new_rows])

# --- Type required before closing (original guard) -------------------------------------
if not doc.is_new():
    old_status = frappe.db.get_value("HD Ticket", doc.name, "status")
    if doc.status and doc.status != old_status and doc.status != "Cancelled":
        category = frappe.db.get_value("HD Ticket Status", doc.status, "category")
        if category == "Resolved" and (not doc.ticket_type or doc.ticket_type == "Unspecified"):
            frappe.throw("Fadlan dooro nooca cilada (Ticket Type) ka hor xidhista. / Please set the ticket type before closing.")
