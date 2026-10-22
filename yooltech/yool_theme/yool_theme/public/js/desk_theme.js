/*
 * yool_theme / desk_theme.js  (Frappe Desk, hooks.app_include_js)
 * The Desk sidebar theme is pure CSS (desk_theme.css); this only loads the Manrope web font once,
 * without blocking first paint. Idempotent.
 */
(function () {
	"use strict";
	try {
		if (document.getElementById("yool-fig-font")) return;
		var link = document.createElement("link");
		link.id = "yool-fig-font";
		link.rel = "stylesheet";
		link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
		document.head.appendChild(link);
	} catch (e) {
		/* never break Desk */
	}
})();
