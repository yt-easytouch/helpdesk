# Server Script — "Yool Caller Defaults"
# Script Type: API | API Method: yool_caller_defaults | Allow Guest: No
#
# Returns company + caller defaults for the New Ticket forms.
# - Active HD Agent: may pass ?customer=<Customer>; gets that customer's name,
#   primary contact (id + full name) and phone. caller_name is left empty: agents
#   type the caller themselves.
# - Anyone else (portal user): the `customer` argument is ignored; only the
#   caller's own Contact and its single linked Customer are returned.
# Read-only; values are suggestions, the HD Ticket Before Save script enforces.


def normalize_phone(raw):
    cleaned = "".join([c for c in (raw or "").strip() if c not in " -.()"])
    if cleaned.startswith("+"):
        digits = cleaned[1:]
    elif cleaned.startswith("00"):
        digits = cleaned[2:]
    else:
        digits = cleaned
    if digits.startswith("252") and len(digits) == 12:
        local = digits[3:]
    elif digits.startswith("0") and len(digits) == 10:
        local = digits[1:]
    elif len(digits) == 9:
        local = digits
    else:
        local = ""
    if digits.isdigit() and len(local) == 9 and local.isdigit() and local[0] != "0":
        return "+252" + local
    if (cleaned.startswith("+") or cleaned.startswith("00")) and digits.isdigit() and 8 <= len(digits) <= 15 and digits[0] != "0":
        # Any other country's full international number, as the validation script stores it.
        return "+" + digits
    return None


def contact_person(contact):
    # Returns a dict: safe_exec does not allow tuple unpacking.
    person = {"name": None, "phone": None}
    if not contact:
        return person
    c = frappe.db.get_value(
        "Contact", contact, ["full_name", "first_name", "last_name", "mobile_no", "phone"], as_dict=True
    )
    if not c:
        return person
    name = (c.full_name or " ".join([p.strip() for p in [c.first_name or "", c.last_name or ""] if p.strip()])).strip()
    person["name"] = name or None
    person["phone"] = c.mobile_no or c.phone
    return person


user = frappe.session.user
if user == "Guest":
    frappe.throw("Not permitted", title="Not permitted")

is_agent = user == "Administrator" or frappe.db.get_value("HD Agent", user, "is_active") == 1
result = {
    "customer": None,
    "customer_name": None,
    "contact": None,
    "primary_contact_name": None,
    "caller_name": None,
    "caller_phone": None,
}

if is_agent:
    customer = frappe.form_dict.get("customer")
    row = frappe.db.get_value(
        "Customer", customer, ["name", "customer_name", "customer_primary_contact", "mobile_no"], as_dict=True
    ) if customer else None
    if row:
        person = contact_person(row.customer_primary_contact)
        result["customer"] = row.name
        result["customer_name"] = row.customer_name
        result["contact"] = row.customer_primary_contact
        result["primary_contact_name"] = person["name"]
        result["caller_phone"] = normalize_phone(row.mobile_no) or normalize_phone(person["phone"])
else:
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
            company = frappe.db.get_value(
                "Customer", links[0][0], ["customer_name", "customer_primary_contact"], as_dict=True
            )
            if company:
                result["customer"] = links[0][0]
                result["customer_name"] = company.customer_name
                result["primary_contact_name"] = contact_person(company.customer_primary_contact)["name"]
        person = contact_person(contact)
        result["contact"] = contact
        result["caller_name"] = person["name"]
        result["caller_phone"] = normalize_phone(person["phone"])
    if not result["caller_name"]:
        result["caller_name"] = frappe.db.get_value("User", user, "full_name")
    if not result["caller_phone"]:
        result["caller_phone"] = normalize_phone(frappe.db.get_value("User", user, "mobile_no"))

frappe.response["message"] = result
