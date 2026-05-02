# helpdesk/helpdesk/whatsapp_utils.py

import frappe
from frappe import _

def after_ticket_insert(doc, method):
    send_whatsapp_notification(doc, "New Ticket")

def on_ticket_update(doc, method):
    if doc.flags.in_insert:
        return

    if doc.has_value_changed("agent_group"):
        send_whatsapp_notification(doc, "Ticket Assigned")

    if doc.has_value_changed("status"):
        send_whatsapp_notification(doc, "Status Changed")

    if doc.has_value_changed("customer") or doc.has_value_changed("contact"):
        send_whatsapp_notification(doc, "Customer Changed")

def after_todo_insert(doc, method):
    if doc.reference_type == "HD Ticket":
        ticket = frappe.get_doc("HD Ticket", doc.reference_name)
        send_whatsapp_notification(ticket, "Ticket Assigned")

def send_whatsapp_notification(ticket, event):
    """
    Find matching notification rules and send WhatsApp messages.
    """
    rules = frappe.get_all(
        "HD Ticket Notification",
        filters={
            "event": event,
            "enabled": 1
        },
        fields=["*"]
    )

    for rule_data in rules:
        rule = frappe.get_doc("HD Ticket Notification", rule_data.name)
        
        # Filter: Team
        if rule.agent_group and ticket.agent_group != rule.agent_group:
            continue
        
        # Filter: Status
        if rule.status_filters:
            rule_statuses = [d.status for d in rule.status_filters]
            if ticket.status not in rule_statuses:
                continue

        # Filter: Created By
        if rule.created_by != "All":
            is_customer = bool(ticket.via_customer_portal)
            if rule.created_by == "Customer" and not is_customer:
                continue
            if rule.created_by == "Agent" and is_customer:
                continue

        # Filter: Assigned Agents (Table MultiSelect)
        ticket_assignees = get_ticket_assignees(ticket.name)
        if rule.assigned_agents:
            rule_agents = [d.user for d in rule.assigned_agents]
            # If ANY of the ticket assignees are in the rule's agent list
            if not any(user in rule_agents for user in ticket_assignees):
                continue

        # Determine Recipients
        recipients = []
        if rule.recipient_type == "Team Group":
            number = rule.whatsapp_group_number
            if not number and ticket.agent_group:
                number = frappe.db.get_value("HD Team", ticket.agent_group, "whatsapp_group_number")
            if number:
                recipients.append(number)
        
        elif rule.recipient_type == "Customer":
            # Check Contact first
            if ticket.contact:
                mobile = frappe.db.get_value("Contact", ticket.contact, "mobile_no") or \
                         frappe.db.get_value("Contact", ticket.contact, "phone")
                if mobile:
                    recipients.append(mobile)
            
            # Check customer doctype for custom fields
            if ticket.customer:
                try:
                    customer_doctype = (
                        frappe.db.get_single_value("HD Settings", "customer_doctype") or "HD Customer"
                    )
                    customer_data = frappe.db.get_value(
                        customer_doctype,
                        ticket.customer,
                        ["custom_whatsapp_number", "custom_whatsapp_group"],
                        as_dict=1
                    )
                    if customer_data:
                        if customer_data.get("custom_whatsapp_number"):
                            recipients.append(customer_data.custom_whatsapp_number)
                        if customer_data.get("custom_whatsapp_group"):
                            recipients.append(customer_data.custom_whatsapp_group)
                except Exception:
                    pass
        
        elif rule.recipient_type == "Assigned Agent":
            for agent_user in ticket_assignees:
                # If rule has a specific agent list, only send to those if assigned
                if rule.assigned_agents:
                    rule_agents = [d.user for d in rule.assigned_agents]
                    if agent_user not in rule_agents:
                        continue
                
                mobile = frappe.db.get_value("User", agent_user, "mobile_no")
                if mobile:
                    recipients.append(mobile)

        if not recipients:
            continue

        # Format message
        message = format_whatsapp_message(rule.message, ticket)

        # Send via sadarsms_erp
        for recipient in recipients:
            try:
                # Try common import paths for sadarsms_erp
                try:
                    from sadarsms_erp.sadarsms_erp.doctype.whatsapp_config.whatsapp_config import send_whatsapp_message
                except ImportError:
                    from sadarsms_erp.sadarsms_erp.sadarsms_erp.doctype.whatsapp_config.whatsapp_config import send_whatsapp_message
                
                send_whatsapp_message(
                    recipient=recipient,
                    message=message,
                    config_name=rule.whatsapp_config
                )
            except Exception as e:
                frappe.log_error(frappe.get_traceback(), f"WhatsApp Send Error to {recipient}: {str(e)}")

def get_ticket_assignees(ticket_name):
    """
    Get list of users assigned to the ticket.
    """
    from frappe.desk.form.assign_to import get as get_assignments
    assignments = get_assignments({"doctype": "HD Ticket", "name": ticket_name})
    return [d.owner for d in assignments]

def format_whatsapp_message(template, ticket):
    """
    Replace placeholders in the template with ticket values using Jinja.
    Also exposes the customer document as `customer` in the template context.
    """
    context = {"doc": ticket}

    if ticket.customer:
        customer_doctype = (
            frappe.db.get_single_value("HD Settings", "customer_doctype") or "HD Customer"
        )
        try:
            customer_doc = frappe.get_doc(customer_doctype, ticket.customer)
            context["customer"] = customer_doc
            context["customer_whatsapp"] = customer_doc.get("custom_whatsapp_number") or ""
            context["customer_group"] = customer_doc.get("custom_whatsapp_group") or ""
        except Exception:
            context["customer"] = None
            context["customer_whatsapp"] = ""
            context["customer_group"] = ""

    if ticket.contact:
        try:
            contact = frappe.get_doc("Contact", ticket.contact)
            context["contact"] = contact
            context["contact_phone"] = contact.mobile_no or contact.phone or ""
        except Exception:
            context["contact"] = None
            context["contact_phone"] = ""

    # Assigned agents (single or multiple)
    assigned_users = []
    for agent_email in get_ticket_assignees(ticket.name):
        try:
            u = frappe.get_doc("User", agent_email)
            assigned_users.append({
                "name": u.full_name,
                "first_name": u.first_name,
                "phone": u.mobile_no or u.phone or "",
                "email": u.name
            })
        except Exception:
            pass

    context["assigned_users"] = assigned_users
    # First assigned agent shortcut
    context["assigned_user"] = assigned_users[0] if assigned_users else {"name": "", "phone": "", "email": ""}

    # Today's date
    import datetime
    now = datetime.datetime.now()
    context["today"] = now.strftime("%d-%m-%Y")
    context["today_time"] = now.strftime("%d-%m-%Y %H:%M")

    return frappe.render_template(template, context)
