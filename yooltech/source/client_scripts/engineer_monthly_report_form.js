// Client Script — "Engineer Monthly Report Form"
// DocType: Engineer Monthly Report | View: Form | Enabled
// Buttons: "Refresh data" (re-pulls tickets, keeps typed challenges/feedback/head comment),
// status buttons (Draft -> Submitted -> Approved, Submitted -> Draft for managers; the rules are enforced
// server-side by Server Script "Engineer Monthly Report Validate"), and for managers
// "Generate for all agents". Download buttons live in Client Script "Engineer Monthly Report Downloads".
// The action bodies are exposed on window.yool_emr so the dashboard Client Script
// ("Engineer Monthly Report Dashboard") can reuse them without clicking toolbar buttons.

window.yool_emr = window.yool_emr || {};
Object.assign(window.yool_emr, {
	set_status: async (frm, next) => {
		const prev = frm.doc.status;
		await frm.set_value("status", next);
		try {
			await frm.save();
			frappe.show_alert({ message: __("Status: {0}", [__(next)]), indicator: "green" });
		} catch (e) {
			await frm.reload_doc();
			if (frm.doc.status !== prev) frm.refresh();
		}
	},

	refresh_data: async (frm) => {
		// Save typed text first so nothing is lost when the doc is reloaded.
		if (frm.is_dirty()) await frm.save();
		await frappe.call({
			method: "yool_engineer_report_refresh",
			args: { name: frm.doc.name },
			freeze: true,
			freeze_message: __("Refreshing tickets..."),
		});
		await frm.reload_doc();
		frappe.show_alert({ message: __("Data refreshed"), indicator: "green" });
	},

	submit: (frm) =>
		frappe.confirm(__("Submit this report to the Agent Manager?"), () => window.yool_emr.set_status(frm, "Submitted")),

	approve: (frm) => {
		if (!(frm.doc.head_comment || "").trim()) {
			frappe.msgprint({ title: __("Head Comment required"), message: __("Please write the Head Comment before approving this report."), indicator: "red" });
			frm.scroll_to_field("head_comment");
			return;
		}
		return window.yool_emr.set_status(frm, "Approved");
	},

	send_back: (frm) => window.yool_emr.set_status(frm, "Draft"),

	generate_all: (frm) => {
		frappe.prompt(
			[
				{ fieldname: "period_type", label: __("Period Type"), fieldtype: "Select", options: "Month\nWeek\nCustom", default: frm.doc.period_type || "Month", reqd: 1 },
				{ fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frm.doc.from_date || frappe.datetime.month_start(), reqd: 1 },
				{ fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frm.doc.to_date || frappe.datetime.month_end(), reqd: 1 },
			],
			async (v) => {
				const r = await frappe.call({
					method: "yool_engineer_report_generate_all",
					args: v,
					freeze: true,
					freeze_message: __("Generating reports..."),
				});
				const names = r.message || [];
				frappe.show_alert({ message: __("{0} reports ready", [names.length]), indicator: "green" });
				frappe.set_route("List", "Engineer Monthly Report", { from_date: v.from_date, to_date: v.to_date });
			},
			__("Generate for all agents"),
			__("Generate")
		);
	},
});

frappe.ui.form.on("Engineer Monthly Report", {
	onload(frm) {
		if (frm.is_new() && !frm.doc.engineer) frm.set_value("engineer", frappe.session.user);
	},

	refresh(frm) {
		const isManager = frappe.user.has_role("Agent Manager") || frappe.user.has_role("System Manager");
		const status = frm.doc.status || "Draft";
		if (frm.is_new()) return;

		if (status !== "Approved" && (status === "Draft" || isManager)) {
			frm.add_custom_button(__("Refresh data"), () => window.yool_emr.refresh_data(frm));
		}

		if (status === "Draft") {
			frm.add_custom_button(__("Submit for approval"), () => window.yool_emr.submit(frm), __("Status"));
		}
		if (status === "Submitted" && isManager) {
			frm.add_custom_button(__("Approve"), () => window.yool_emr.approve(frm), __("Status"));
			frm.add_custom_button(__("Send back to Draft"), () => window.yool_emr.send_back(frm), __("Status"));
		}

		if (isManager) {
			frm.add_custom_button(__("Generate for all agents"), () => window.yool_emr.generate_all(frm));
		}
	},
});
