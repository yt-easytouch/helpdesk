// HD Form Script — "Agent Report Sidebar Button" (dt: HD Ticket, apply_to: Form,
// apply_on_new_page: 1, agents only).
//
// The sidebar item itself is a public HD View ("Agent Report", VIEW-HD Ticket-1237)
// whose route is the new-ticket page, so Helpdesk renders it natively on every page.
// Helpdesk runs this script on that page; when it was opened through the view, the
// "Agent Ticket Report" Script Report is shown over the content area (same tab,
// sidebar stays). Leaving the page removes it. No Helpdesk files are changed.
function setupForm() {
	const VIEW = "VIEW-HD Ticket-1237";
	const OVERLAY_ID = "yool-agent-ticket-report-view";
	const REPORT = "Agent Ticket Report";
	const URL = "/app/query-report/" + encodeURIComponent(REPORT);
	// Hide the Desk sidebar inside the embedded report so it fits the Helpdesk layout.
	const EMBED_CSS =
		".body-sidebar-container,.body-sidebar-placeholder{display:none!important}.main-section{margin-left:0!important}";
	const state = window.__yoolAgentReport || (window.__yoolAgentReport = {});

	const isReportRoute = () =>
		/\/helpdesk\/tickets\/new\/?$/.test(window.location.pathname) &&
		new URLSearchParams(window.location.search).get("view") === VIEW;

	const findMain = () => {
		const row = document.querySelector("#app .h-screen");
		return row ? [...row.children].find((c) => c.classList.contains("flex-1")) : null;
	};

	const close = () => {
		const overlay = document.getElementById(OVERLAY_ID);
		if (!overlay) return;
		const main = overlay.parentElement;
		overlay.remove();
		if (main) main.style.overflow = state.mainOverflow || "";
	};

	const open = (allowed) => {
		const main = findMain();
		if (!main || document.getElementById(OVERLAY_ID)) return;

		const overlay = document.createElement("div");
		overlay.id = OVERLAY_ID;
		overlay.style.cssText = "position:absolute;inset:0;z-index:30;background:var(--surface-white, #fff);";
		if (allowed) {
			const frame = document.createElement("iframe");
			frame.src = URL;
			frame.title = REPORT;
			frame.style.cssText = "width:100%;height:100%;border:0;display:block;";
			frame.addEventListener("load", () => {
				try {
					const style = frame.contentDocument.createElement("style");
					style.textContent = EMBED_CSS;
					frame.contentDocument.head.appendChild(style);
				} catch (e) {
					// Not accessible: the report still works, just with the Desk sidebar.
				}
			});
			overlay.appendChild(frame);
		} else {
			overlay.style.display = "flex";
			overlay.style.alignItems = "center";
			overlay.style.justifyContent = "center";
			overlay.textContent = "Only Agent Manager / System Manager can view the Agent Ticket Report.";
		}

		state.mainOverflow = main.style.overflow;
		main.scrollTop = 0;
		main.style.overflow = "hidden";
		main.appendChild(overlay);
	};

	const sync = () => {
		if (!isReportRoute()) return close();
		Promise.resolve(state.allowed).then((ok) => isReportRoute() && open(ok));
	};

	if (state.allowed === undefined) {
		state.allowed = fetch(
			"/api/method/frappe.desk.query_report.get_script?report_name=" + encodeURIComponent(REPORT),
			{ headers: { Accept: "application/json" } }
		)
			.then((r) => r.ok)
			.catch(() => false);
	}

	// Follow Helpdesk route changes for the rest of the session (one watcher only).
	// Polling the URL also catches query-only changes, where Vue reuses the page
	// and this script is not run again.
	if (!state.watcher) {
		state.href = window.location.href;
		state.watcher = setInterval(() => {
			const missing = isReportRoute() && !document.getElementById(OVERLAY_ID);
			if (state.href === window.location.href && !missing) return;
			state.href = window.location.href;
			sync();
		}, 300);
	}
	sync();

	return { actions: [] };
}
