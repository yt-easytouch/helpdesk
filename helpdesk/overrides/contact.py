import frappe


def before_insert(doc, method=None):
    if doc.email_id:
        domain = doc.email_id.split("@")[1]
        
        customer_doctype = (
            frappe.db.get_single_value("HD Settings", "customer_doctype") or "HD Customer"
        )
        
        if frappe.get_meta(customer_doctype).has_field("domain"):
            customers = frappe.get_all(
                customer_doctype, filters={"domain": domain}, fields=["name"]
            )
            if customers:
                doc.append(
                    "links",
                    {"link_doctype": customer_doctype, "link_name": customers[0].name},
                )
