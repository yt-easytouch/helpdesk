# Server Script — "HD Ticket Caller Validation"
# Script Type: DocType Event | Reference Doctype: HD Ticket | Event: Before Save
#
# 1. Company: erp_customer (Company / Shirkadda) and the standard customer field are
#    kept in sync; erp_customer_name and primary_contact_name (Primary Contact /
#    Macmiilka) always come from the Customer record.
#    Portal (Website) users can only ever get their own linked Customer; whatever
#    they send is ignored, and they cannot change it on existing tickets.
# 2. New tickets created by an agent must have caller_name and caller_phone
#    (email / customer-portal / system-created tickets are not blocked).
# 3. caller_phone: Somali formats are normalized to +252XXXXXXXXX; any other full
#    international number (+country code, 8-15 digits) is kept as +<digits>.
#    Anything else is rejected.
# Old tickets are not touched unless someone edits these fields.

user = frappe.session.user
is_agent_user = user not in ("Administrator", "Guest") and frappe.db.get_value("HD Agent", user, "is_active") == 1
is_portal_user = (
    user not in ("Administrator", "Guest")
    and not is_agent_user
    and frappe.db.get_value("User", user, "user_type") == "Website User"
)

if is_portal_user:
    if doc.is_new():
        # Only the Customer linked to the portal user's own Contact (exactly one), else none.
        own_customer = None
        contact = frappe.db.get_value("Contact", {"user": user}, "name") or frappe.db.get_value(
            "Contact", {"email_id": user}, "name"
        )
        if contact:
            links = frappe.db.sql(
                "SELECT DISTINCT link_name FROM `tabDynamic Link`"
                " WHERE parenttype = 'Contact' AND parentfield = 'links'"
                " AND link_doctype = 'Customer' AND parent = %(contact)s",
                {"contact": contact},
            )
            if len(links) == 1:
                own_customer = links[0][0]
        doc.erp_customer = own_customer
        doc.customer = own_customer
        if not (doc.caller_name or "").strip():
            doc.caller_name = frappe.db.get_value("User", user, "full_name")
    elif doc.has_value_changed("erp_customer") or doc.has_value_changed("customer"):
        frappe.throw("Company cannot be changed.  /  Shirkadda lama beddeli karo.", title="Not permitted")
elif doc.is_new():
    # The Company field on the agent form wins; tickets from email/desk keep their customer.
    if doc.erp_customer:
        doc.customer = doc.erp_customer
    elif doc.customer:
        doc.erp_customer = doc.customer
elif doc.has_value_changed("erp_customer"):
    doc.customer = doc.erp_customer
elif doc.has_value_changed("customer"):
    doc.erp_customer = doc.customer

doc.erp_customer_name = frappe.db.get_value("Customer", doc.erp_customer, "customer_name") if doc.erp_customer else None
if doc.is_new() or doc.has_value_changed("erp_customer"):
    primary = frappe.db.get_value("Customer", doc.erp_customer, "customer_primary_contact") if doc.erp_customer else None
    doc.primary_contact_name = (frappe.db.get_value("Contact", primary, "full_name") or None) if primary else None

caller_name = (doc.caller_name or "").strip()
raw_phone = (doc.caller_phone or "").strip()
doc.caller_name = caller_name or None
doc.caller_role = (doc.caller_role or "").strip() or None

if doc.is_new() and is_agent_user and (not caller_name or not raw_phone):
    frappe.throw(
        "Fadlan geli magaca iyo lambarka qofka la soo xiriiray (Caller Name iyo Caller Phone).  /  "
        "Please enter the Caller Name and Caller Phone.",
        title="Caller details required",
    )

if raw_phone:
    # Only spaces, dashes, dots and brackets are dropped; anything else stays and fails the check.
    cleaned = "".join([c for c in raw_phone if c not in " -.()"])
    if cleaned.startswith("+"):
        digits = cleaned[1:]
    elif cleaned.startswith("00"):
        digits = cleaned[2:]
    else:
        digits = cleaned

    # Local part = the 9 digits after the 252 country code.
    if digits.startswith("252") and len(digits) == 12:
        local = digits[3:]
    elif digits.startswith("0") and len(digits) == 10:
        local = digits[1:]
    elif len(digits) == 9:
        local = digits
    else:
        local = ""

    if digits.isdigit() and len(local) == 9 and local.isdigit() and local[0] != "0":
        # Somali number -> always stored as +252XXXXXXXXX.
        doc.caller_phone = "+252" + local
    elif (cleaned.startswith("+") or cleaned.startswith("00")) and digits.isdigit() and 8 <= len(digits) <= 15 and digits[0] != "0":
        # Any other country's full international (E.164) number -> stored as +<digits>.
        doc.caller_phone = "+" + digits
    else:
        frappe.throw(
            "Geli number buuxa oo caalami ah (+ country code), ama number Soomaali ah (06.../+252...). "
            "Tusaale: 06XXXXXXXX, +2526XXXXXXXX ama +44XXXXXXXXXX.  /  "
            "Enter a full international number (+country code) or a Somali number. "
            "Example: 06XXXXXXXX, +2526XXXXXXXX or +44XXXXXXXXXX.",
            title="Invalid Caller Phone",
        )
else:
    doc.caller_phone = None
