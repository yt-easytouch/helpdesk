frappe.ui.form.on("Chatwoot Sync Log", {
	refresh(frm) {
		frm.disable_save();
		if (frm.doc.direction !== "Outbound" || !["Failed", "Skipped"].includes(frm.doc.status)) return;
		frm.add_custom_button(__("Retry"), () => {
			frappe.call({ method: "chatwoot_api", args: { action: "retry", payload: { log: frm.doc.name } }, freeze: true }).then((r) => {
				const m = (r.message || {}).chatwoot_result || {};
				frappe.msgprint({
					title: m.ok ? __("Retried: success") : __("Retried: still failing"),
					indicator: m.ok ? "green" : "red",
					message: m.log ? __("New log row:") + ` <a href="${frappe.utils.get_form_link("Chatwoot Sync Log", m.log)}">${m.log}</a>` : "",
				});
			});
		}).addClass("btn-primary");
	},
});
