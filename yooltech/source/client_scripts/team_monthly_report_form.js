// Client Script — "Team Monthly Report Form"
// DocType: Team Monthly Report | View: Form | Enabled
// Buttons: "Refresh data" (re-pulls tickets/expenses, keeps typed text) and the status flow
// Draft -> Submitted -> Approved (Submitted -> Draft to send back). The rules are enforced server-side
// by Server Script "Team Monthly Report Validate"; approving stamps approved_by with the session user.
// The action bodies are exposed on window.yool_tmr so the dashboard Client Script
// ("Team Monthly Report Dashboard") can reuse them without clicking toolbar buttons.
// window.yool_tmr.download_pdf / download_word are installed by the Downloads script (C2); the dashboard
// hides its download buttons while they are not defined.

window.yool_tmr = window.yool_tmr || {};
Object.assign(window.yool_tmr, {
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
			method: "yool_team_report_refresh",
			args: { name: frm.doc.name },
			freeze: true,
			freeze_message: __("Refreshing team data..."),
		});
		await frm.reload_doc();
		frappe.show_alert({ message: __("Data refreshed"), indicator: "green" });
	},

	submit: (frm) =>
		frappe.confirm(__("Submit this team report for approval?"), () => window.yool_tmr.set_status(frm, "Submitted")),

	approve: (frm) =>
		frappe.confirm(__("Approve this team report? It will be locked afterwards."), () =>
			window.yool_tmr.set_status(frm, "Approved")),

	send_back: (frm) => window.yool_tmr.set_status(frm, "Draft"),
});

frappe.ui.form.on("Team Monthly Report", {
	onload(frm) {
		if (frm.is_new()) {
			if (!frm.doc.from_date) frm.set_value("from_date", frappe.datetime.month_start());
			if (!frm.doc.to_date) frm.set_value("to_date", frappe.datetime.month_end());
		}
	},

	refresh(frm) {
		const status = frm.doc.status || "Draft";
		if (frm.is_new()) return;

		if (status !== "Approved") {
			frm.add_custom_button(__("Refresh data"), () => window.yool_tmr.refresh_data(frm));
		}

		if (status === "Draft") {
			frm.add_custom_button(__("Submit for approval"), () => window.yool_tmr.submit(frm), __("Status"));
		}
		if (status === "Submitted") {
			frm.add_custom_button(__("Approve"), () => window.yool_tmr.approve(frm), __("Status"));
			frm.add_custom_button(__("Send back to Draft"), () => window.yool_tmr.send_back(frm), __("Status"));
		}

		// Download buttons appear once the Downloads script (C2) defines the functions.
		if (typeof window.yool_tmr.download_pdf === "function") {
			frm.add_custom_button(__("Download PDF"), () => window.yool_tmr.download_pdf(frm));
		}
		if (typeof window.yool_tmr.download_word === "function") {
			frm.add_custom_button(__("Download Word"), () => window.yool_tmr.download_word(frm));
		}
	},
});
