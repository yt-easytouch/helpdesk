// HD Form Script — "Helpdesk Figma Theme" (dt: HD Ticket, apply_to: Form, apply_on_new_page: 1).
// The SAME code is also installed as "Helpdesk Figma Theme Ticket" (apply_on_new_page: 0), which
// Helpdesk runs on every agent ticket detail page, so the theme arms from either entry point.
//
// Design: Figma "UI-dinsg" Side Menu, node 10450:5374
// (https://www.figma.com/design/kkmiC7lB8fcrjDcpTrW160/UI-dinsg?node-id=10450-5374), variant
// "Type=Primary" 10450:5450 for the expanded sidebar and "Type=Dual" 10450:5471 for the rail:
//   - white bg, 1px #dadadb right border, Manrope; expanded width 256px (stock 224px; Figma 272px)
//   - items 36px tall (8px/12px padding, 20px line), 20px stroke icons, 12px icon gap, 4px corners,
//     4px between items, text 14px/500 #4a4c4f, hover #f0f0f1
//   - ACTIVE item: brand green #1db487 with white text + icon (Figma active state)
//   - section labels uppercase #8f9193, hairline dividers between groups
//   - collapsed rail (stock 50px) keeps its geometry; icons get the same 20px Figma set
//   - HOME PAGE ONLY (route-scoped class yool-fig-home): #fafafa page bg, white KPI/SLA/chart cards,
//     1px #dadadb borders, 4px corners, uppercase card labels, chart lines brand green.
//
// How it loads: Helpdesk only fetches HD Form Scripts on the new-ticket page and ticket detail pages,
// never on /helpdesk/home, and helpdesk.html renders no admin-configurable head/CSS. So a DIRECT load
// of /helpdesk/home stays stock until a ticket / Kanban / Agent Report / new-ticket page is opened once.
// Direct-load fix (config only, NOT applied yet - needs the site owner's approval): two rows in
// Website Settings > Route Redirects, status 302:
//     helpdesk/home -> /helpdesk/tickets/new?yool_to=home      helpdesk -> same target
// The new-ticket page loads this script, which sees ?yool_to=home and router.replace()s back to Home
// (SPA, no reload), so the user ends on /helpdesk/home themed. Without those rows this branch is inert.
// A window-scoped route watcher keeps classes + icons in sync across SPA navigation for the session.
// No Helpdesk app files are changed. Icons are static markup shipped below (nothing user-provided).
function setupForm(ctx) {
	const router = ctx && ctx.router;
	const VERSION = "2-10450:5374";

	// ---- direct-load bounce back to Home (see header) ----
	try {
		const to = new URLSearchParams(window.location.search).get("yool_to");
		if (to === "home" && router && /^\/helpdesk\/tickets\/new\/?$/.test(window.location.pathname)) {
			Promise.resolve(router.replace({ name: "Home" })).then(() => {
				if (/New Ticket/.test(document.title)) document.title = "Helpdesk";
			});
		}
	} catch (e) {
		/* never block the page */
	}

	const state = window.__yoolFigTheme || (window.__yoolFigTheme = {});

	const B = ".yool-fig .bg-surface-menu-bar";
	const E = B + "[style*='224px']"; // expanded (stock inline min/max-width 224px)
	const C = B + "[style*='50px']"; // collapsed rail
	const I = " div.cursor-pointer[class*='h-7']"; // nav item rows (Search .. Collapse)
	const MANROPE = "'Manrope',ui-sans-serif,system-ui,-apple-system,sans-serif";

	const CSS = [
		/* ---------- Sidebar shell ---------- */
		B + "{background:#fff !important;border-color:#dadadb !important;font-family:" + MANROPE + " !important;}",
		E + "{min-width:256px !important;max-width:256px !important;}",
		/* workspace header (logo 32px r8, brand name bold #070a0e) */
		E + ">div:first-child{padding:16px 12px 8px !important;}",
		B + ">div:first-child>button{border-radius:4px !important;}",
		B + ">div:first-child>button:hover{background:#f0f0f1 !important;}",
		B + " button img{border-radius:8px !important;}",
		B + " button [class*='text-ink-gray-9']{font-weight:800;font-size:15px;color:#070a0e;letter-spacing:-.01em;}",
		B + " button [class*='text-ink-gray-7']{color:#8f9193;font-size:12px;font-weight:500;}",

		/* ---------- Items ---------- */
		B + I + "{border-radius:4px !important;color:#4a4c4f;transition:background-color .15s ease;}",
		B + I + ":hover{background:#f0f0f1 !important;}",
		E + I + "{height:36px !important;padding:0 12px !important;margin:2px 12px !important;}",
		E + I + ">div{margin-left:12px !important;}",
		B + I + " span.truncate{font-size:14px;font-weight:500;line-height:20px;color:#4a4c4f;}",
		B + I + ">span.shrink-0{color:#4a4c4f;display:flex;align-items:center;justify-content:center;}",
		B + I + ">span.shrink-0 svg{width:20px !important;height:20px !important;}",
		C + I + "{height:32px !important;padding-left:6px !important;padding-right:6px !important;}",
		/* Search shortcut badge (cmd K) */
		B + I + " span.truncate+span{border:1px solid #dadadb;border-radius:4px;background:#fafafa;padding:0 5px;height:20px;font-size:11px;color:#8f9193;}",
		B + I + " span.truncate+span svg{width:11px;height:11px;}",
		/* active item -> brand green, white text/icon */
		B + " .bg-surface-selected{background:#1db487 !important;box-shadow:none !important;}",
		B + " .bg-surface-selected:hover{background:#18a077 !important;}",
		B + " .bg-surface-selected span.truncate{color:#fff !important;font-weight:600 !important;}",
		B + " .bg-surface-selected>span.shrink-0{color:#fff !important;}",

		/* ---------- Section labels + dividers ---------- */
		B + " div.cursor-pointer[class*='text-ink-gray-5'][class*='px-2']{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8f9193;}",
		E + " div.cursor-pointer[class*='text-ink-gray-5'][class*='px-2']{margin:4px 12px 2px !important;padding:0 12px !important;}",
		B + " div[class*='my-2.5']{border-top:1px solid #ededee;}",
		E + " div[class*='my-2.5']{margin:12px 24px !important;}",
		/* Getting started card (bottom) */
		B + ">div>.px-2>.bg-surface-modal.rounded-lg{border:1px solid #dadadb;border-radius:4px !important;box-shadow:none !important;background:#fafafa !important;}",
		B + ">div>.px-2>.bg-surface-modal.rounded-lg>button{background:#e8f7f1 !important;color:#0f8a63 !important;border-radius:4px !important;font-weight:600;}",
		B + ">div>.px-2>.bg-surface-modal.rounded-lg>button:hover{background:#d2f0e4 !important;}",
		E + ">div>.px-2>.bg-surface-modal.rounded-lg{margin:0 4px;}",

		/* ---------- Home page only (html.yool-fig-home) ---------- */
		".yool-fig-home #app .h-screen>.flex-1{background:#fafafa;font-family:" + MANROPE + ";}",
		".yool-fig-home #app .h-screen>.flex-1>div:first-child{background:#fff;border-color:#dadadb !important;}",
		".yool-fig-home .h-screen .flex-1 [class*='text-xl'][class*='font-semibold']{font-weight:800;color:#070a0e;font-size:21px;}",
		".yool-fig-home section.vgl-item [class*='border-outline-gray-1']{background:#fff;border:1px solid #dadadb !important;border-radius:4px !important;}",
		".yool-fig-home section.vgl-item [class*='text-ink-gray-5'][class*='text-base']{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8f9193;}",
		".yool-fig-home section.vgl-item [class*='text-2xl']{font-size:28px;font-weight:800;color:#070a0e;}",
		".yool-fig-home section.vgl-item [class*='text-lg']{font-weight:700;color:#070a0e;}",
		".yool-fig-home section.vgl-item svg path[stroke='#5597F3'],",
		".yool-fig-home section.vgl-item svg path[stroke='#F35555'],",
		".yool-fig-home section.vgl-item svg path[stroke='#7263E8'],",
		".yool-fig-home section.vgl-item svg path[stroke='#171717']{stroke:#1db487 !important;}",
		/* Average Time Metrics bars: first-response series -> brand green */
		".yool-fig-home section.vgl-item svg path[fill='#171717']{fill:#1db487 !important;}",
		".yool-fig-home section.vgl-item .size-2.rounded-full.bg-surface-gray-7{background:#1db487 !important;}",
	].join("\n");

	// Figma 10450:5374 icon set (20x20, 1.5 stroke) mapped to Helpdesk sidebar labels.
	const ICONS = {
		"Search": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16.6667 16.6667L13.375 13.375M15.0983 9.21583C15.0983 12.4646 12.4646 15.0983 9.21583 15.0983C5.96702 15.0983 3.33333 12.4646 3.33333 9.21583C3.33333 5.96702 5.96702 3.33333 9.21583 3.33333C12.4646 3.33333 15.0983 5.96702 15.0983 9.21583Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Home": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16.6667 12.9583H12.5M12.5 16.2083H16.6667M6.66667 8.33333H4.16667C3.72464 8.33333 3.30072 8.15774 2.98816 7.84518C2.67559 7.53262 2.5 7.10869 2.5 6.66667V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H6.66667C7.10869 2.5 7.53262 2.67559 7.84518 2.98816C8.15774 3.30072 8.33333 3.72464 8.33333 4.16667V6.66667C8.33333 7.10869 8.15774 7.53262 7.84518 7.84518C7.53262 8.15774 7.10869 8.33333 6.66667 8.33333ZM15.8333 8.33333H13.3333C12.8913 8.33333 12.4674 8.15774 12.1548 7.84518C11.8423 7.53262 11.6667 7.10869 11.6667 6.66667V4.16667C11.6667 3.72464 11.8423 3.30072 12.1548 2.98816C12.4674 2.67559 12.8913 2.5 13.3333 2.5H15.8333C16.2754 2.5 16.6993 2.67559 17.0118 2.98816C17.3244 3.30072 17.5 3.72464 17.5 4.16667V6.66667C17.5 7.10869 17.3244 7.53262 17.0118 7.84518C16.6993 8.15774 16.2754 8.33333 15.8333 8.33333ZM6.66667 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V13.3333C2.5 12.8913 2.67559 12.4674 2.98816 12.1548C3.30072 11.8423 3.72464 11.6667 4.16667 11.6667H6.66667C7.10869 11.6667 7.53262 11.8423 7.84518 12.1548C8.15774 12.4674 8.33333 12.8913 8.33333 13.3333V15.8333C8.33333 16.2754 8.15774 16.6993 7.84518 17.0118C7.53262 17.3244 7.10869 17.5 6.66667 17.5Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Dashboard": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12.5 17.0833H16.25C16.5815 17.0833 16.8995 16.9516 17.1339 16.7172C17.3683 16.4828 17.5 16.1649 17.5 15.8333V4.16667C17.5 3.83515 17.3683 3.5172 17.1339 3.28278C16.8995 3.04836 16.5815 2.91667 16.25 2.91667H13.75C13.4185 2.91667 13.1005 3.04836 12.8661 3.28278C12.6317 3.5172 12.5 3.83515 12.5 4.16667V17.0833ZM12.5 17.0833H7.5M7.5 17.0833V8.75C7.5 8.41848 7.6317 8.10054 7.86612 7.86612C8.10054 7.6317 8.41848 7.5 8.75 7.5H12.5M7.5 17.0833V12.5H3.75C3.41848 12.5 3.10054 12.6317 2.86612 12.8661C2.6317 13.1005 2.5 13.4185 2.5 13.75V15.8333C2.5 16.1649 2.6317 16.4828 2.86612 16.7172C3.10054 16.9516 3.41848 17.0833 3.75 17.0833H7.5Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Tickets": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12.5 7.08333H7.5M10 10.4167H7.5M5 2.5H15C15.663 2.5 16.2989 2.76339 16.7678 3.23223C17.2366 3.70107 17.5 4.33696 17.5 5V12.5C17.5 13.163 17.2366 13.7989 16.7678 14.2678C16.2989 14.7366 15.663 15 15 15H6.25L3.17333 17.4108C3.11181 17.4589 3.038 17.4888 2.96033 17.497C2.88265 17.5052 2.80425 17.4914 2.73405 17.4571C2.66384 17.4229 2.60468 17.3696 2.56329 17.3034C2.52191 17.2371 2.49998 17.1606 2.5 17.0825V5C2.5 4.33696 2.76339 3.70107 3.23223 3.23223C3.70107 2.76339 4.33696 2.5 5 2.5Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Knowledge Base": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M16.6667 7.08333H13.75C13.308 7.08333 12.884 6.90774 12.5715 6.59518C12.2589 6.28262 12.0833 5.85869 12.0833 5.41667V2.5M13.3333 13.75H6.66667M6.66667 10.8333H13.3333M15.9342 5.10083L14.0667 3.23333C13.8344 3.00082 13.5587 2.81637 13.2551 2.69054C12.9515 2.56471 12.6261 2.49996 12.2975 2.5H5.83333C5.17029 2.5 4.53441 2.76339 4.06557 3.23223C3.59673 3.70107 3.33333 4.33696 3.33333 5V15C3.33333 15.663 3.59673 16.2989 4.06557 16.7678C4.53441 17.2366 5.17029 17.5 5.83333 17.5H14.1667C14.8297 17.5 15.4656 17.2366 15.9344 16.7678C16.4033 16.2989 16.6667 15.663 16.6667 15V6.86917C16.6667 6.54075 16.602 6.21554 16.4763 5.91212C16.3507 5.60871 16.1664 5.33303 15.9342 5.10083Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Customers": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M2.5 6.25H17.5M13.3333 9.16667C13.3333 10.0507 12.9821 10.8986 12.357 11.5237C11.7319 12.1488 10.8841 12.5 10 12.5C9.11594 12.5 8.2681 12.1488 7.64298 11.5237C7.01786 10.8986 6.66667 10.0507 6.66667 9.16667M3.33333 3.33333H16.6667C16.8877 3.33333 17.0996 3.42113 17.2559 3.57741C17.4122 3.73369 17.5 3.94565 17.5 4.16667V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.94565 2.5878 3.73369 2.74408 3.57741C2.90036 3.42113 3.11232 3.33333 3.33333 3.33333Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Contacts": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13.3333 16.6667V15.8333C13.3333 14.9493 12.9821 14.1014 12.357 13.4763C11.7319 12.8512 10.8841 12.5 10 12.5H5C4.11594 12.5 3.2681 12.8512 2.64298 13.4763C2.01786 14.1014 1.66667 14.9493 1.66667 15.8333V16.6667M18.3333 16.6667V15.8333C18.3333 14.9493 17.9821 14.1014 17.357 13.4763C16.7319 12.8512 15.8841 12.5 15 12.5M12.5 2.5C13.3841 2.5 14.2319 2.85119 14.857 3.47631C15.4821 4.10143 15.8333 4.94928 15.8333 5.83333C15.8333 6.71739 15.4821 7.56524 14.857 8.19036C14.2319 8.81548 13.3841 9.16667 12.5 9.16667M10.8333 5.83333C10.8333 7.67428 9.34095 9.16667 7.5 9.16667C5.65905 9.16667 4.16667 7.67428 4.16667 5.83333C4.16667 3.99238 5.65905 2.5 7.5 2.5C9.34095 2.5 10.8333 3.99238 10.8333 5.83333Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Agent Report": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.50583 12.0833H12.5058M8.75 8.58333L9.75 9.58333L11.4167 7.91667M16.2075 16.9967L15.3825 17.4117C15.2672 17.4695 15.14 17.4997 15.011 17.5C14.882 17.5003 14.7547 17.4706 14.6392 17.4133L13.3283 16.7658L12.045 17.4108C11.9293 17.4689 11.8016 17.4992 11.6722 17.4993C11.5427 17.4995 11.415 17.4695 11.2992 17.4117L10 16.765L8.70083 17.4117C8.5851 17.4693 8.45754 17.4993 8.32823 17.4991C8.19893 17.499 8.07143 17.4688 7.95583 17.4108L6.67167 16.7658L5.36083 17.4133C5.24525 17.4706 5.11796 17.5003 4.98897 17.5C4.85998 17.4997 4.73282 17.4695 4.6175 17.4117L3.7925 16.9967C3.65441 16.9273 3.53834 16.8209 3.45725 16.6893C3.37616 16.5577 3.33326 16.4062 3.33333 16.2517V3.74833C3.33326 3.59379 3.37616 3.44227 3.45725 3.31071C3.53834 3.17915 3.65441 3.07272 3.7925 3.00333L4.6175 2.58833C4.73282 2.53055 4.85998 2.50032 4.98897 2.50003C5.11796 2.49974 5.24525 2.5294 5.36083 2.58667L6.67167 3.23417L7.955 2.58917C8.07071 2.5311 8.19836 2.5008 8.32782 2.50065C8.45728 2.50051 8.58499 2.53053 8.70083 2.58833L10 3.235L11.2992 2.58833C11.4149 2.53066 11.5425 2.50072 11.6718 2.50086C11.8011 2.50101 11.9286 2.53124 12.0442 2.58917L13.3283 3.23417L14.6392 2.58667C14.7547 2.5294 14.882 2.49974 15.011 2.50003C15.14 2.50032 15.2672 2.53055 15.3825 2.58833L16.2075 3.00333C16.3456 3.07272 16.4617 3.17915 16.5427 3.31071C16.6238 3.44227 16.6667 3.59379 16.6667 3.74833V16.2525C16.6666 16.4069 16.6236 16.5582 16.5425 16.6896C16.4615 16.821 16.3455 16.9273 16.2075 16.9967Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
		"Kanban": "<svg viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M5.83333 6.66667H4.58333C4.0308 6.66667 3.50089 6.88616 3.11019 7.27686C2.71949 7.66756 2.5 8.19747 2.5 8.75V15.4167C2.5 15.9692 2.71949 16.4991 3.11019 16.8898C3.50089 17.2805 4.0308 17.5 4.58333 17.5H12.9167C13.4692 17.5 13.9991 17.2805 14.3898 16.8898C14.7805 16.4991 15 15.9692 15 15.4167V13.3333M17.7233 4.39L16.4433 3.11C16.2498 2.91656 16.0201 2.76312 15.7673 2.65846C15.5145 2.55379 15.2436 2.49995 14.97 2.5H7.91667C7.36413 2.5 6.83423 2.71949 6.44353 3.11019C6.05283 3.5009 5.83333 4.0308 5.83333 4.58333V11.25C5.83333 11.8025 6.05283 12.3324 6.44353 12.7231C6.83423 13.1138 7.36413 13.3333 7.91667 13.3333H16.25C16.8025 13.3333 17.3324 13.1138 17.7231 12.7231C18.1138 12.3324 18.3333 11.8025 18.3333 11.25V5.86333C18.3334 5.58973 18.2795 5.31879 18.1749 5.06599C18.0702 4.8132 17.9168 4.58349 17.7233 4.39Z\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
	};

	const swapIcons = () => {
		if (!document.documentElement.classList.contains("yool-fig")) return;
		const bar = document.querySelector(".bg-surface-menu-bar");
		if (!bar) return;
		bar.querySelectorAll("div.cursor-pointer[class*='h-7']").forEach((item) => {
			const label = item.querySelector("span.truncate");
			const slot = item.querySelector("span.shrink-0");
			if (!label || !slot || slot.dataset.yoolIcon === VERSION) return;
			const svg = ICONS[label.textContent.trim()];
			if (!svg) return;
			slot.dataset.yoolIcon = VERSION;
			// Static markup shipped inside this script (above); nothing user-provided.
			slot.innerHTML = svg;
			const el = slot.querySelector("svg");
			el.setAttribute("width", "20");
			el.setAttribute("height", "20");
		});
	};

	const sync = () => {
		const p = window.location.pathname;
		const agent = /^\/helpdesk\//.test(p) && !/^\/helpdesk\/(my-tickets|kb-public)/.test(p);
		const html = document.documentElement;
		html.classList.toggle("yool-fig", agent);
		html.classList.toggle("yool-fig-home", /^\/helpdesk\/home\/?$/.test(p));
		swapIcons();
	};

	if (state.version !== VERSION) {
		if (state.watcher) clearInterval(state.watcher);
		state.installed = true;
		state.version = VERSION;
		if (!document.getElementById("yool-fig-font")) {
			const link = document.createElement("link");
			link.id = "yool-fig-font";
			link.rel = "stylesheet";
			link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
			document.head.appendChild(link);
		}
		let style = document.getElementById("yool-fig-style");
		if (!style) {
			style = document.createElement("style");
			style.id = "yool-fig-style";
			document.head.appendChild(style);
		}
		style.textContent = CSS;
		state.watcher = setInterval(sync, 300);
	}
	sync();
	return { actions: [] };
}
