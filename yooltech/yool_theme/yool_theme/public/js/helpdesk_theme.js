/*
 * yool_theme / helpdesk_theme.js  (Helpdesk 1.26 SPA, loaded next to helpdesk_theme.css)
 *
 * Only does what CSS cannot:
 *   1. html.yool-fig-home on the Home route (route-scoped Home dashboard styling),
 *   2. data-yool-label="<label>" on each sidebar nav item, so the CSS can map Figma icons by label
 *      (Public Views such as "Agent Report"/"Kanban" have emoji icons with no SVG to match),
 *   3. loads the Manrope web font once (same element id as the HD Form Script overlay).
 * Idempotent: guarded by window.__yoolTheme; safe next to window.__yoolFigTheme (HD Form Scripts).
 * Never throws into the page.
 */
(function () {
	"use strict";
	var VERSION = "0.1.0";
	var state = window.__yoolTheme || (window.__yoolTheme = {});
	if (state.helpdesk === VERSION) return;
	state.helpdesk = VERSION;

	var ITEM = "div.cursor-pointer[class*='h-7']";

	function loadFont() {
		if (document.getElementById("yool-fig-font")) return;
		var link = document.createElement("link");
		link.id = "yool-fig-font";
		link.rel = "stylesheet";
		link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
		document.head.appendChild(link);
	}

	function sync() {
		try {
			var p = window.location.pathname;
			var html = document.documentElement;
			html.classList.toggle("yool-fig-home", /^\/helpdesk\/home\/?$/.test(p));
			html.classList.toggle("yool-hd-portal", /^\/helpdesk\/(my-tickets|kb-public)/.test(p));
			var bar = document.querySelector(".bg-surface-menu-bar");
			if (!bar) return;
			var items = bar.querySelectorAll(ITEM);
			for (var i = 0; i < items.length; i++) {
				var label = items[i].querySelector("span.truncate");
				var text = label ? label.textContent.trim() : "";
				if (text && items[i].getAttribute("data-yool-label") !== text) {
					items[i].setAttribute("data-yool-label", text);
				}
			}
		} catch (e) {
			/* never break the page */
		}
	}

	var queued = false;
	function schedule() {
		if (queued) return;
		queued = true;
		window.requestAnimationFrame(function () {
			queued = false;
			sync();
		});
	}

	function start() {
		loadFont();
		sync();
		// Vue re-renders the sidebar on navigation / collapse / view changes: re-label on DOM changes.
		state.observer = new MutationObserver(schedule);
		state.observer.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("popstate", schedule);
	}

	if (document.body) start();
	else document.addEventListener("DOMContentLoaded", start);
})();
