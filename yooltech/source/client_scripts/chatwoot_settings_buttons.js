// Both buttons go through the server door (chatwoot_api); the browser never sees the token.
frappe.ui.form.on("Chatwoot Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Test connection"), () => {
			if (frm.is_dirty()) return frappe.msgprint(__("Save the settings first."));
			frappe.call({ method: "chatwoot_api", args: { action: "test_connection" }, freeze: true }).then((r) => {
				const m = (r.message || {}).chatwoot_result || {};
				const link = m.log ? ` <a href="${frappe.utils.get_form_link("Chatwoot Sync Log", m.log)}">${m.log}</a>` : "";
				if (m.skipped) return frappe.msgprint({ title: __("Not tested"), indicator: "orange", message: __("API token, base URL or account ID is missing.") + link });
				frappe.msgprint({
					title: m.ok ? __("Connected") : __("Connection failed"),
					indicator: m.ok ? "green" : "red",
					message: m.ok
						? __("Chatwoot answered. Inboxes: {0}", [(m.inboxes || []).map((b) => `${frappe.utils.escape_html(b.name)} (#${b.id})`).join(", ")]) + "<br>" + __("Log:") + link
						: __("HTTP {0}: {1}", [m.status, frappe.utils.escape_html(m.error || "")]) + "<br>" + __("Log:") + link,
				});
			});
		});
		frm.add_custom_button(__("Load agents from Chatwoot"), () => {
			frappe.call({ method: "chatwoot_api", args: { action: "list_agents" }, freeze: true }).then((r) => {
				const m = (r.message || {}).chatwoot_result || {};
				if (!m.ok) return frappe.msgprint(__("Could not load agents (HTTP {0}).", [m.status || "-"]));
				const keep = {};
				(frm.doc.agent_map || []).forEach((row) => { if (row.hd_agent) keep[row.chatwoot_agent_id] = row.hd_agent; });
				frm.clear_table("agent_map");
				(m.agents || []).forEach((a) => frm.add_child("agent_map", { ...a, hd_agent: keep[a.chatwoot_agent_id] || a.hd_agent }));
				frm.refresh_field("agent_map");
				frm.dirty();
				frappe.show_alert({ message: __("Agents loaded; matched by email. Review and save."), indicator: "green" });
			});
		});
	},
});
