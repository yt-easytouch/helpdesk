# Server Script "Yool Ticket Preview" — Script Type: API, API Method: yool_ticket_preview (GET, logged-in users).
# Runs inside Frappe safe_exec. Feeds the Ticket board's Preview panel with only what the panel shows:
# ticket summary, SLA, details, the last 3 messages (trimmed text, no attachments) and the last 5 activity entries.
#
# ?ticket=<name>            -> full panel payload
# ?ticket=<name>&check=1    -> {"modified": ...} only (cheap poll for changes made by others)
#
# Permissions: helpdesk agents only; the ticket is read through frappe.get_list, which applies the user's
# HD Ticket permissions, so a ticket the user may not read is reported as not found.

ticket = frappe.form_dict.get("ticket")
if not ticket:
    frappe.throw("Ticket is required.")

user = frappe.session.user
if user != "Administrator" and not frappe.db.exists("HD Agent", {"name": user, "is_active": 1}):
    frappe.throw("Only helpdesk agents can preview tickets.")

rows = frappe.get_list(
    "HD Ticket",
    filters={"name": ticket},
    fields=[
        "name", "subject", "status", "status_category", "priority", "ticket_type", "agent_group",
        "customer", "erp_customer_name", "contact", "raised_by", "primary_contact_name", "caller_name",
        "caller_phone", "via_customer_portal", "email_account", "opening_date", "opening_time", "creation",
        "modified", "_assign as assign_json", "sla", "agreement_status", "response_by", "first_responded_on",
        "resolution_by", "resolution_date", "on_hold_since", "source_team",
    ],
    limit_page_length=1,
)
if not rows:
    frappe.throw("Ticket " + str(ticket) + " was not found, or you do not have access to it.")
t = rows[0]

if frappe.form_dict.get("check"):
    frappe.response["message"] = {"name": t.name, "modified": str(t.modified)}
else:
    try:
        assigned = json.loads(t.assign_json or "[]") or []  # safe_exec blocks "_" attributes, hence the alias
    except Exception:
        assigned = []

    # Names and pictures for everyone shown in the panel, in one query.
    people = {}
    emails = list(assigned)
    messages = frappe.get_all(
        "Communication",
        filters={"reference_doctype": "HD Ticket", "reference_name": t.name, "communication_type": "Communication"},
        fields=["name", "sender", "sender_full_name", "creation", "content", "sent_or_received"],
        order_by="creation desc",
        limit_page_length=3,
    )
    comments = frappe.get_all(
        "HD Ticket Comment",
        filters={"reference_ticket": t.name},
        fields=["name", "commented_by", "owner", "creation", "content"],
        order_by="creation desc",
        limit_page_length=3,
    )
    activity = frappe.get_all(
        "HD Ticket Activity",
        filters={"ticket": t.name},
        fields=["action", "owner", "creation"],
        order_by="creation desc",
        limit_page_length=5,
    )
    for m in messages:
        emails.append(m.sender)
    for c in comments:
        emails.append(c.commented_by or c.owner)
    for a in activity:
        emails.append(a.owner)
    emails = [e for e in set(emails) if e]
    if emails:
        for u in frappe.get_all("User", filters={"name": ["in", emails]}, fields=["name", "full_name", "user_image"]):
            people[u.name] = {"name": u.full_name or u.name, "image": u.user_image}

    conversation = []
    for m in messages:
        who = people.get(m.sender) or {}
        conversation.append({
            "kind": "message",
            "sender": m.sender,
            "sender_name": m.sender_full_name or who.get("name") or m.sender,
            "image": who.get("image"),
            "incoming": m.sent_or_received == "Received",
            "at": str(m.creation),
            "text": (frappe.utils.strip_html(m.content or "") or "").strip()[:400],
        })
    for c in comments:
        # Comments added through the API may leave commented_by empty; the author is then the owner.
        author = c.commented_by or c.owner
        who = people.get(author) or {}
        conversation.append({
            "kind": "comment",
            "sender": author,
            "sender_name": who.get("name") or author,
            "image": who.get("image"),
            "incoming": False,
            "at": str(c.creation),
            "text": (frappe.utils.strip_html(c.content or "") or "").strip()[:400],
        })
    conversation = sorted(conversation, key=lambda x: x["at"], reverse=True)[:3]

    if t.via_customer_portal:
        channel = "Customer portal"
    elif t.email_account:
        channel = "Email"
    else:
        channel = "Created by agent"

    # All ticket types (Table MultiSelect ticket_types, first = primary); old tickets: just ticket_type.
    ticket_types = [r.ticket_type for r in frappe.get_all(
        "HD Ticket Type Item",
        filters={"parent": t.name, "parenttype": "HD Ticket", "parentfield": "ticket_types"},
        fields=["ticket_type"],
        order_by="idx asc",
    ) if r.ticket_type]
    if t.ticket_type and t.ticket_type != "Unspecified" and (not ticket_types or ticket_types[0] != t.ticket_type):
        ticket_types = [t.ticket_type] + [x for x in ticket_types if x != t.ticket_type]

    customer_name = t.erp_customer_name
    if t.customer and not customer_name:
        customer_name = frappe.db.get_value("Customer", t.customer, "customer_name")

    # frappe.has_permission is not exposed to server scripts: check the role permissions directly
    # (Custom DocPerm replaces the standard DocPerm when present). The save itself is still checked by Frappe.
    can_write = user == "Administrator"
    if not can_write:
        roles = [r[0] for r in frappe.db.sql(
            "SELECT role FROM `tabHas Role` WHERE parenttype = 'User' AND parent = %(user)s", {"user": user}
        )]
        perm_table = "tabCustom DocPerm" if frappe.db.sql(
            "SELECT COUNT(*) FROM `tabCustom DocPerm` WHERE parent = 'HD Ticket'"
        )[0][0] else "tabDocPerm"
        can_write = bool(roles) and bool(frappe.db.sql(
            "SELECT 1 FROM `" + perm_table + "` WHERE parent = 'HD Ticket' AND permlevel = 0 AND `write` = 1"
            " AND role IN %(roles)s LIMIT 1",
            {"roles": tuple(roles)},
        ))

    frappe.response["message"] = {
        "name": t.name,
        "subject": t.subject,
        "status": t.status,
        "status_category": t.status_category,
        "priority": t.priority,
        "ticket_type": t.ticket_type,
        "ticket_types": ticket_types,
        "team": t.agent_group,
        "source_team": t.source_team,
        "channel": channel,
        "customer": t.customer,
        "customer_name": customer_name,
        "contact": t.contact or t.raised_by,
        "primary_contact": t.primary_contact_name,
        "caller_name": t.caller_name,
        "caller_phone": t.caller_phone,
        "opened": str(t.opening_date) + " " + str(t.opening_time or "00:00:00") if t.opening_date else str(t.creation),
        "modified": str(t.modified),
        "assigned": [{"user": u, "name": (people.get(u) or {}).get("name") or u, "image": (people.get(u) or {}).get("image")} for u in assigned],
        "sla": {
            "name": t.sla,
            "status": t.agreement_status,
            "response_by": str(t.response_by) if t.response_by else None,
            "first_responded_on": str(t.first_responded_on) if t.first_responded_on else None,
            "resolution_by": str(t.resolution_by) if t.resolution_by else None,
            "resolution_date": str(t.resolution_date) if t.resolution_date else None,
            "on_hold_since": str(t.on_hold_since) if t.on_hold_since else None,
        },
        "conversation": conversation,
        "activity": [
            {"action": a.action, "by": (people.get(a.owner) or {}).get("name") or a.owner, "at": str(a.creation)}
            for a in activity
        ],
        "can_write": bool(can_write),
    }
