// HD Form Script — "Caller Autofill" (dt: HD Ticket, apply_to: Form, apply_on_new_page: 1).
// Helpdesk also runs new-page scripts on the customer portal, so this handles both:
//
// Agent  (/helpdesk/tickets/new):
//   - Company / Shirkadda (erp_customer) drives the ticket's customer and contact; the
//     built-in Customer/Contact pickers are hidden so there is only one place to choose.
//   - Choosing a company fills Primary Contact (read-only), the ticket contact and Caller
//     Phone from the ERPNext Customer (via the yool_caller_defaults API). Caller Name is
//     never filled from the company: the agent types who actually called.
//   - Entering a Caller Phone used on an earlier ticket fills Caller Name / Position,
//     but only while those are still empty.
// Portal (/helpdesk/my-tickets/new):
//   - Pre-fills their company's Primary Contact (read-only) and their own name/phone.
//
// Autofill never overwrites what a person typed: it only fills empty fields or fields
// it filled itself. The HD Ticket Before Save script enforces the real rules.
function setupForm({ doc }) {
	const path = window.location.pathname;
	const isAgentNew = /\/helpdesk\/tickets\/new\/?$/.test(path);
	const isPortalNew = /\/helpdesk\/my-tickets\/new\/?$/.test(path);
	if (!isAgentNew && !isPortalNew) return { actions: [] };

	// Same rules as the "HD Ticket Caller Validation" server script.
	const normalize = (raw) => {
		const cleaned = String(raw || "").replace(/[\s\-.()]/g, "");
		let digits = cleaned;
		if (cleaned.startsWith("+")) digits = cleaned.slice(1);
		else if (cleaned.startsWith("00")) digits = cleaned.slice(2);
		let local = "";
		if (digits.startsWith("252") && digits.length === 12) local = digits.slice(3);
		else if (digits.startsWith("0") && digits.length === 10) local = digits.slice(1);
		else if (digits.length === 9) local = digits;
		if (/^\d+$/.test(digits) && /^[1-9]\d{8}$/.test(local)) return "+252" + local;
		// Any other country's full international number (+ / 00 + 8-15 digits).
		if ((cleaned.startsWith("+") || cleaned.startsWith("00")) && /^[1-9]\d{7,14}$/.test(digits)) return "+" + digits;
		return null;
	};

	const callerDefaults = async (args) => {
		try {
			const r = await fetch("/api/method/yool_caller_defaults?" + new URLSearchParams(args || {}).toString(), {
				headers: { Accept: "application/json" },
			});
			return r.ok ? (await r.json()).message || null : null;
		} catch (e) {
			return null;
		}
	};

	// Values this script filled in, so it only ever replaces its own suggestions.
	const filled = {};
	const suggest = (field, value) => {
		if (doc[field] && doc[field] !== filled[field]) return;
		doc[field] = value || "";
		filled[field] = doc[field];
	};

	// Runs fn(el) once el exists (the form renders after this script), for up to 10s.
	const whenReady = (find, fn) => {
		let tries = 0;
		const timer = setInterval(() => {
			const el = find();
			if (el || ++tries > 40) {
				clearInterval(timer);
				if (el) fn(el);
			}
		}, 250);
	};
	const fieldInput = (label) => {
		const span = [...document.querySelectorAll("span")].find((s) => s.textContent.trim().replace(/\s*\*$/, "") === label);
		// Template field markup: <div><span>Label *</span><div><input/></div></div>
		return span && span.parentElement ? span.parentElement.querySelector("input") : null;
	};
	const lockPrimaryContact = () =>
		whenReady(
			() => fieldInput("Primary Contact / Macmiilka"),
			(input) => {
				input.readOnly = true;
				input.tabIndex = -1;
				input.style.cursor = "default";
			}
		);

	if (isPortalNew) {
		lockPrimaryContact();
		callerDefaults().then((info) => {
			if (!info) return;
			doc.erp_customer = info.customer || "";
			doc.primary_contact_name = info.primary_contact_name || "";
			suggest("caller_name", info.caller_name);
			suggest("caller_phone", info.caller_phone);
		});
		return { actions: [] };
	}

	// Agent form: hide the built-in Customer / Contact pickers (Company replaces them).
	whenReady(
		() => {
			const labels = [...document.querySelectorAll("span, label, div")].filter((e) => e.children.length === 0);
			const customer = labels.find((e) => e.textContent.trim() === "Customer");
			const contact = labels.find((e) => e.textContent.trim() === "Contact");
			if (!customer || !contact) return null;
			let row = customer.parentElement;
			while (row && !row.contains(contact)) row = row.parentElement;
			// Never hide anything that also holds the subject or the template fields.
			if (!row || row.querySelector('input[placeholder="A short description"]')) return null;
			return row;
		},
		(row) => (row.style.display = "none")
	);
	lockPrimaryContact();

	const onCompany = async (customer) => {
		const info = customer ? await callerDefaults({ customer }) : null;
		doc.customer = customer || "";
		doc.primary_contact_name = (info && info.primary_contact_name) || "";
		suggest("contact", info && info.contact);
		suggest("caller_phone", info && info.caller_phone);
	};

	const onPhone = async (value) => {
		const phone = normalize(value);
		if (!phone || (doc.caller_name && doc.caller_role)) return;
		const params = new URLSearchParams({
			doctype: "HD Ticket",
			fields: JSON.stringify(["caller_name", "caller_role"]),
			filters: JSON.stringify([["caller_phone", "=", phone], ["caller_name", "is", "set"]]),
			order_by: "creation desc",
			limit_page_length: "1",
		});
		try {
			const r = await fetch("/api/method/frappe.client.get_list?" + params.toString(), {
				headers: { Accept: "application/json" },
			});
			const last = ((await r.json()).message || [])[0];
			if (!last) return;
			if (!doc.caller_name) doc.caller_name = last.caller_name;
			if (!doc.caller_role && last.caller_role) doc.caller_role = last.caller_role;
		} catch (e) {
			// Suggestion only: ignore lookup failures.
		}
	};

	return { actions: [], onChange: { erp_customer: onCompany, caller_phone: onPhone } };
}
