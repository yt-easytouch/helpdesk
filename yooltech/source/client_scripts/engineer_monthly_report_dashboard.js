// Client Script: "Engineer Monthly Report Dashboard"  (DocType: Engineer Monthly Report, Apply To: Form, Enabled)
// Renders a dashboard into the HTML field "ui_dashboard" (first field of the form). The real fields stay in the
// collapsed "Advanced / Raw data" sections below, so saving, permissions, Print and Word keep working unchanged.
// Edits write to the real fields / child rows (frm.set_value, frappe.model.set_value, frm.add_child) and are saved
// when the user leaves the field (or with the Save button / Ctrl+S). Actions reuse the functions exposed by the
// "Engineer Monthly Report Form" (B) and "Engineer Monthly Report Downloads" (C) scripts on window.yool_emr; if a
// function is not exposed, the matching toolbar button is clicked instead. Nothing here calls an API directly.
// Visual language: Figma "UI-dinsg" (kkmiC7lB8fcrjDcpTrW160) - Chart Cards Light, Bar chart Light, Button,
// Button Group, Badge/Pill, Progress bars, Avatar label. All CSS is scoped under .yemr.
(() => {
	const DOCTYPE = "Engineer Monthly Report";
	const FIELD = "ui_dashboard";
	const STYLE_ID = "yemr-style";
	const ROWS_PER_PAGE = 20;
	const AUTOSAVE_MS = 900;
	// Hide B/C's toolbar buttons that the dashboard duplicates (they stay in the DOM and keep working).
	const HIDE_TOOLBAR_DUPLICATES = true;
	// Section breaks holding the raw fields; collapsed unless the user opens "Advanced / Raw data".
	const RAW_SECTIONS = ["advanced_section", "summary_section", "activities_section", "challenges_section", "feedback_section", "head_section"];
	const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	const NS = (window.yool_emr = window.yool_emr || {});
	const UI = (NS.ui = NS.ui || {});

	// ---------- CSS (Figma tokens; dark mode = Helpdesk/Desk dark surfaces, same roles) ----------
	const CSS = `
.yemr {
	--y-font: "Manrope", var(--font-stack, system-ui), sans-serif;
	--y-canvas: #f0f0f1; --y-card: #ffffff; --y-subtle: #fafafa; --y-hover: #f0f0f1;
	--y-border: #dadadb; --y-divider: #f0f0f1; --y-axis: #8f9193;
	--y-t900: #070a0e; --y-t500: #4a4c4f; --y-t300: #8f9193; --y-white: #ffffff;
	--y-brand: #1db487; --y-brand-hover: #1aa37a; --y-brand-soft: #e9fbf6; --y-brand-text: #1aa37a; --y-brand-border: #9ef0d7;
	--y-bar: #dadadb;
	--y-ok-bg: #e7f6e7; --y-ok-text: #0d720a; --y-ok-border: #92d490; --y-ok-bold: #11930d;
	--y-warn-bg: #fff9f0; --y-warn-text: #db8000; --y-warn-border: #ffe3bd; --y-warn-bold: #fa9200;
	--y-err-bg: #faebeb; --y-err-text: #942528; --y-err-border: #eaa2a3; --y-err-bold: #be2f33;
	--y-info-bg: #e7effc; --y-info-text: #0d469e; --y-info-border: #92b7f0; --y-info-bold: #115acb;
	--y-c-office: #1aa37a; --y-c-visit: #3b6fe0; --y-c-remote: #e07b39;
	--y-shadow: 0 8px 32px -2px rgba(16, 24, 32, 0.08);
	font-family: var(--y-font); color: var(--y-t900); background: transparent;
	padding: 0; margin: 0 0 8px; display: flex; flex-direction: column; gap: 16px;
	-webkit-font-smoothing: antialiased; box-sizing: border-box; min-width: 0;
}
[data-theme="dark"] .yemr {
	--y-canvas: #141414; --y-card: #1f1f1f; --y-subtle: #232323; --y-hover: #2a2a2a;
	--y-border: #343434; --y-divider: #2a2a2a; --y-axis: #5c5c5c;
	--y-t900: #f5f5f5; --y-t500: #b4b4b4; --y-t300: #808080;
	--y-brand-soft: rgba(29, 180, 135, 0.16); --y-brand-text: #6ee8c3; --y-brand-border: rgba(110, 232, 195, 0.35);
	--y-bar: #3a3a3a;
	--y-ok-bg: rgba(19, 161, 14, 0.16); --y-ok-text: #7ad277; --y-ok-border: rgba(122, 210, 119, 0.35);
	--y-warn-bg: rgba(250, 146, 0, 0.14); --y-warn-text: #fdb022; --y-warn-border: rgba(253, 176, 34, 0.35);
	--y-err-bg: rgba(209, 52, 56, 0.16); --y-err-text: #f08b8e; --y-err-border: rgba(240, 139, 142, 0.35);
	--y-info-bg: rgba(19, 99, 223, 0.18); --y-info-text: #8fb4f5; --y-info-border: rgba(143, 180, 245, 0.35);
	--y-c-office: #1fa47c; --y-c-visit: #5a8bef; --y-c-remote: #d4783a;
	--y-shadow: 0 8px 32px -2px rgba(0, 0, 0, 0.5);
}
.yemr *, .yemr *::before, .yemr *::after { box-sizing: border-box; font-family: inherit; }
.yemr button { font: inherit; color: inherit; }
.yemr [hidden] { display: none !important; }
.yemr .yemr-card { background: var(--y-card); border: 1px solid var(--y-border); padding: 24px; min-width: 0; position: relative; }
.yemr .yemr-h { display: flex; align-items: flex-start; gap: 12px; margin: 0 0 24px; }
.yemr .yemr-h-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.yemr .yemr-title { font: 500 20px/28px var(--y-font); color: var(--y-t900); margin: 0; }
.yemr .yemr-sub { font: 500 14px/20px var(--y-font); color: var(--y-t300); margin: 0; }
.yemr .yemr-eyebrow { font: 600 12px/18px var(--y-font); letter-spacing: .06em; text-transform: uppercase; color: var(--y-t300); }
.yemr .yemr-muted { color: var(--y-t300); }
.yemr svg { flex: 0 0 auto; display: block; }

/* Buttons (Figma Button: Primary / Secondary gray / Ghost gray, Medium 36px, radius 4) */
.yemr .yemr-btn { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 16px;
	border-radius: 4px; border: 1px solid var(--y-border); background: var(--y-card); color: var(--y-t900);
	font: 500 14px/20px var(--y-font); cursor: pointer; white-space: nowrap; transition: background .12s, border-color .12s; }
.yemr .yemr-btn:hover { background: var(--y-hover); }
.yemr .yemr-btn:focus-visible { outline: 2px solid #6ee8c3; outline-offset: 1px; }
.yemr .yemr-btn[disabled] { opacity: .5; cursor: default; }
.yemr .yemr-btn--primary { background: var(--y-brand); border-color: var(--y-brand); color: #fff; }
.yemr .yemr-btn--primary:hover { background: var(--y-brand-hover); border-color: var(--y-brand-hover); }
.yemr .yemr-btn--ghost { border-color: transparent; background: transparent; color: var(--y-t500); }
.yemr .yemr-btn--ghost:hover { background: var(--y-hover); color: var(--y-t900); }
.yemr .yemr-btn--danger { color: var(--y-err-text); }
.yemr .yemr-btn--icon { width: 36px; padding: 0; }
.yemr .yemr-btn--sm { height: 28px; padding: 4px 10px; font-size: 13px; }

/* Badge (outline, radius 4) and Pill (soft, radius 120) */
.yemr .yemr-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 4px; border: 1px solid var(--y-border);
	background: var(--y-card); font: 500 14px/20px var(--y-font); color: var(--y-t500); white-space: nowrap; }
.yemr .yemr-badge--brand { border-color: var(--y-brand-border); color: var(--y-brand-text); }
.yemr .yemr-badge--ok { border-color: var(--y-ok-border); color: var(--y-ok-text); }
.yemr .yemr-badge--info { border-color: var(--y-info-border); color: var(--y-info-text); }
.yemr .yemr-badge--warn { border-color: var(--y-warn-border); color: var(--y-warn-text); }
.yemr .yemr-pill { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 120px; font: 500 14px/20px var(--y-font);
	white-space: nowrap; background: var(--y-hover); color: var(--y-t500); }
.yemr .yemr-pill--ok { background: var(--y-ok-bg); color: var(--y-ok-text); }
.yemr .yemr-pill--warn { background: var(--y-warn-bg); color: var(--y-warn-text); }
.yemr .yemr-pill--err { background: var(--y-err-bg); color: var(--y-err-text); }
.yemr .yemr-pill--info { background: var(--y-info-bg); color: var(--y-info-text); }
.yemr .yemr-pill--brand { background: var(--y-brand-soft); color: var(--y-brand-text); }
.yemr .yemr-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* Header card */
.yemr .yemr-head { display: flex; flex-direction: column; gap: 20px; }
.yemr .yemr-head-top { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.yemr .yemr-who { display: flex; align-items: center; gap: 12px; flex: 1 1 260px; min-width: 0; }
.yemr .yemr-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--y-hover); color: var(--y-t900); flex: 0 0 48px;
	display: flex; align-items: center; justify-content: center; font: 600 16px/24px var(--y-font); overflow: hidden; }
.yemr .yemr-avatar img { width: 100%; height: 100%; object-fit: cover; }
.yemr .yemr-who-text { min-width: 0; display: flex; flex-direction: column; }
.yemr .yemr-name { font: 600 24px/32px var(--y-font); color: var(--y-t900); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.yemr .yemr-email { font: 400 14px/20px var(--y-font); color: var(--y-t500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.yemr .yemr-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.yemr .yemr-meta { display: flex; flex-wrap: wrap; gap: 16px 0; padding-top: 20px; border-top: 1px solid var(--y-divider); }
.yemr .yemr-meta-group { display: flex; flex-direction: column; gap: 8px; padding: 0 24px; border-left: 1px solid var(--y-divider); min-width: 0; }
.yemr .yemr-meta-group:first-child { padding-left: 0; border-left: 0; }
.yemr .yemr-meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 500 14px/20px var(--y-font); color: var(--y-t900); }
.yemr .yemr-save-state { font: 500 13px/20px var(--y-font); color: var(--y-t300); display: inline-flex; align-items: center; gap: 6px; }
.yemr .yemr-save-state.is-dirty { color: var(--y-warn-text); }

/* ··· menu (Figma dropdown list) */
.yemr .yemr-menu-wrap { position: relative; }
.yemr .yemr-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 240px; padding: 8px; display: none; flex-direction: column; gap: 2px;
	background: var(--y-card); border: 1px solid var(--y-divider); border-radius: 8px; box-shadow: var(--y-shadow); }
.yemr .yemr-menu.is-open { display: flex; }
.yemr .yemr-menu-label { padding: 6px 12px 2px; }
.yemr .yemr-menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; border: 0; background: none; text-align: left;
	font: 500 14px/20px var(--y-font); color: var(--y-t900); cursor: pointer; white-space: nowrap; }
.yemr .yemr-menu-item:hover { background: var(--y-hover); }
.yemr .yemr-menu-item[disabled] { color: var(--y-t300); cursor: default; background: none; }
.yemr .yemr-menu-sep { height: 1px; background: var(--y-divider); margin: 4px 0; }

/* KPI tiles (Figma Chart Cards: label 16/24 gray-500, value 32/44 semibold, 40px icon tile) */
.yemr .yemr-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.yemr .yemr-kpi { display: flex; flex-direction: column; gap: 4px; transition: box-shadow .15s ease, transform .15s ease; }
.yemr .yemr-kpi:hover { box-shadow: var(--y-shadow); transform: translateY(-2px); }
.yemr .yemr-kpi-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.yemr .yemr-icon-tile { width: 40px; height: 40px; border-radius: 4px; background: var(--y-hover); color: var(--y-t900); display: flex; align-items: center; justify-content: center; }
.yemr .yemr-kpi-label { font: 500 16px/24px var(--y-font); color: var(--y-t500); min-width: 0; }
.yemr .yemr-kpi-value { font: 600 clamp(32px, 1.4vw + 16px, 42px)/1.3 var(--y-font); color: var(--y-t900); font-variant-numeric: tabular-nums; }
.yemr .yemr-kpi-foot { font: 500 13px/20px var(--y-font); color: var(--y-t300); display: flex; align-items: center; gap: 6px; min-height: 20px; }
.yemr .yemr-kpi-foot .is-up { color: var(--y-ok-bold); display: inline-flex; align-items: center; gap: 4px; }

/* Row of insight cards */
.yemr .yemr-insights { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.75fr) minmax(0, 1.5fr); gap: 16px; }

/* Missing time card (Figma Progress bar: 6px track, rounded) */
.yemr .yemr-progress { height: 6px; border-radius: 6px; background: var(--y-hover); overflow: hidden; margin: 16px 0 12px; }
.yemr .yemr-progress > span { display: block; height: 100%; border-radius: 6px; background: var(--y-brand); }
.yemr .yemr-progress.is-warn > span { background: var(--y-warn-bold); }
.yemr .yemr-progress.is-err > span { background: var(--y-err-bold); }
.yemr .yemr-missing-value { font: 600 32px/44px var(--y-font); font-variant-numeric: tabular-nums; }
.yemr .yemr-missing-value small { font: 500 16px/24px var(--y-font); color: var(--y-t300); margin-left: 4px; }
.yemr .yemr-hint { display: flex; gap: 8px; align-items: flex-start; font: 500 13px/20px var(--y-font); color: var(--y-t500);
	background: var(--y-subtle); border-radius: 4px; padding: 8px 10px; }
.yemr .yemr-hint.is-err { background: var(--y-err-bg); color: var(--y-err-text); }
.yemr .yemr-hint.is-ok { background: var(--y-ok-bg); color: var(--y-ok-text); }

/* Bar chart (Figma Bar chart Light: grey bars, peak in brand green, axis line 0.5px, labels 14/20) */
.yemr .yemr-bars { position: relative; height: 170px; display: flex; align-items: flex-end; gap: 4px; padding: 0 2px; }
.yemr .yemr-grid { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--y-divider); pointer-events: none; }
.yemr .yemr-grid span { position: absolute; right: 0; top: -18px; font: 500 11px/16px var(--y-font); color: var(--y-t300); }
.yemr .yemr-bar { flex: 1 1 0; min-width: 0; max-width: 40px; height: 100%; display: flex; align-items: flex-end; justify-content: center; position: relative; cursor: default; margin: 0 auto; }
.yemr .yemr-bar i { display: block; width: 100%; max-width: 22px; background: var(--y-bar); border-radius: 4px 4px 0 0; min-height: 2px; transition: background .12s; }
.yemr .yemr-bar.is-peak i { background: var(--y-brand); }
.yemr .yemr-bar.is-zero i { min-height: 2px; background: var(--y-divider); }
.yemr .yemr-bar:hover i { background: var(--y-brand-hover); }
.yemr .yemr-bar b { position: absolute; bottom: calc(var(--h) + 4px); font: 600 12px/16px var(--y-font); color: var(--y-t900); }
.yemr .yemr-bar[data-tip]:hover::after { content: attr(data-tip); position: absolute; bottom: calc(var(--h) + 24px); left: 50%; transform: translateX(-50%);
	background: var(--y-t900); color: var(--y-card); font: 500 12px/16px var(--y-font); padding: 6px 8px; border-radius: 4px; white-space: nowrap; z-index: 5; pointer-events: none; }
.yemr .yemr-axis { display: flex; gap: 4px; padding: 8px 2px 0; border-top: .5px solid var(--y-axis); }
.yemr .yemr-axis span { flex: 1 1 0; min-width: 0; max-width: 40px; margin: 0 auto; text-align: center; font: 500 12px/16px var(--y-font); color: var(--y-t500); white-space: nowrap; overflow: visible; }

/* Donut + legend (Figma Chart Cards donut) */
.yemr .yemr-split { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 20px; }
.yemr .yemr-donut { position: relative; width: 140px; height: 140px; flex: 0 0 140px; }
.yemr .yemr-donut svg { width: 100%; height: 100%; }
.yemr .yemr-donut-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.yemr .yemr-donut-c strong { font: 600 24px/32px var(--y-font); }
.yemr .yemr-donut-c span { font: 500 12px/16px var(--y-font); color: var(--y-t300); }
.yemr .yemr-legend { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column; }
.yemr .yemr-legend-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--y-divider); font: 500 14px/20px var(--y-font); color: var(--y-t500); }
.yemr .yemr-legend-row:last-child { border-bottom: 0; }
.yemr .yemr-swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 10px; }
.yemr .yemr-legend-row .yemr-lg-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.yemr .yemr-legend-row strong { color: var(--y-t900); font-weight: 600; font-variant-numeric: tabular-nums; }
.yemr .yemr-legend-row .yemr-lg-pct { width: 38px; text-align: right; color: var(--y-t300); font-variant-numeric: tabular-nums; }

/* Activity log */
.yemr .yemr-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 0 16px; }
.yemr .yemr-search { height: 36px; flex: 1 1 220px; max-width: 320px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
	border: 1px solid var(--y-border); border-radius: 8px; background: var(--y-card); color: var(--y-t300); }
.yemr .yemr-search:focus-within { border-color: #20c997; }
.yemr .yemr-search input { flex: 1; min-width: 0; border: 0; outline: none; background: none; padding: 0; font: 500 14px/20px var(--y-font); color: var(--y-t900); }
.yemr .yemr-search input::placeholder { color: var(--y-t300); }
.yemr .yemr-seg { display: inline-flex; border: 1px solid var(--y-border); border-radius: 4px; overflow: hidden; background: var(--y-card); }
.yemr .yemr-seg button { height: 34px; padding: 6px 14px; border: 0; border-right: 1px solid var(--y-border); background: none; cursor: pointer;
	font: 600 14px/20px var(--y-font); color: var(--y-t500); display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.yemr .yemr-seg button:last-child { border-right: 0; }
.yemr .yemr-seg button:hover { color: var(--y-t900); }
.yemr .yemr-seg button.is-active { background: var(--y-hover); color: var(--y-t900); }
.yemr .yemr-seg button em { font-style: normal; font-weight: 500; color: var(--y-t300); }
.yemr .yemr-table-wrap { overflow-x: auto; border-top: 1px solid var(--y-divider); margin: 0 -24px; }
.yemr table.yemr-table { width: 100%; border-collapse: separate; border-spacing: 0; font: 500 14px/20px var(--y-font); }
.yemr .yemr-table th { position: sticky; top: 0; z-index: 2; background: var(--y-subtle); text-align: left; padding: 10px 12px;
	font: 600 12px/18px var(--y-font); letter-spacing: .06em; text-transform: uppercase; color: var(--y-t300); border-bottom: 1px solid var(--y-divider); white-space: nowrap; }
.yemr .yemr-table td { padding: 12px; border-bottom: 1px solid var(--y-divider); color: var(--y-t500); vertical-align: middle; }
.yemr .yemr-table th:first-child, .yemr .yemr-table td:first-child { padding-left: 24px; }
.yemr .yemr-table th:last-child, .yemr .yemr-table td:last-child { padding-right: 24px; }
.yemr .yemr-table tbody tr:nth-child(even) td { background: var(--y-subtle); }
.yemr .yemr-table tbody tr:hover td { background: var(--y-hover); }
.yemr .yemr-table .is-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.yemr .yemr-table .yemr-client { color: var(--y-t900); font-weight: 600; }
.yemr .yemr-table .yemr-issue { min-width: 220px; max-width: 420px; }
.yemr .yemr-table .yemr-date { white-space: nowrap; color: var(--y-t500); }
.yemr .yemr-tlink { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 4px; border: 1px solid var(--y-brand-border);
	background: var(--y-card); color: var(--y-brand-text); font: 600 13px/20px var(--y-font); text-decoration: none; white-space: nowrap; font-variant-numeric: tabular-nums; }
.yemr .yemr-tlink:hover { background: var(--y-brand-soft); text-decoration: none; color: var(--y-brand-text); }
.yemr .yemr-chip { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 120px; font: 500 13px/22px var(--y-font); white-space: nowrap; }
.yemr .yemr-chip i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.yemr .yemr-chip--office { background: var(--y-brand-soft); color: var(--y-brand-text); }
.yemr .yemr-chip--visit { background: var(--y-info-bg); color: var(--y-info-text); }
.yemr .yemr-chip--remote { background: var(--y-warn-bg); color: var(--y-warn-text); }
.yemr .yemr-empty { padding: 32px 24px; text-align: center; color: var(--y-t300); font: 500 14px/20px var(--y-font); }
.yemr .yemr-table-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; font: 500 14px/20px var(--y-font); color: var(--y-t300); flex-wrap: wrap; }

/* Challenges, feedback, comments */
.yemr .yemr-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.yemr .yemr-item { border: 1px solid var(--y-divider); background: var(--y-subtle); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.yemr .yemr-item-head { display: flex; align-items: center; gap: 8px; min-height: 28px; flex-wrap: wrap; }
.yemr .yemr-item-head .yemr-grow { flex: 1; }
.yemr .yemr-num { font: 600 14px/20px var(--y-font); color: var(--y-t300); font-variant-numeric: tabular-nums; }
.yemr .yemr-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.yemr .yemr-field-label { font: 500 14px/20px var(--y-font); color: var(--y-t900); }
.yemr .yemr-input { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid var(--y-border); border-radius: 8px; background: var(--y-card);
	color: var(--y-t900); font: 500 14px/20px var(--y-font); resize: none; outline: none; overflow: hidden; display: block; }
.yemr textarea.yemr-input { min-height: 64px; }
.yemr .yemr-input:hover { border-color: var(--y-t300); }
.yemr .yemr-input:focus { border-color: #20c997; box-shadow: 0 0 0 3px var(--y-brand-soft); }
.yemr .yemr-input::placeholder { color: var(--y-t300); }
.yemr .yemr-input[readonly] { background: var(--y-subtle); border-color: var(--y-divider); cursor: default; box-shadow: none; }
.yemr .yemr-ro { font: 500 14px/22px var(--y-font); color: var(--y-t900); white-space: pre-wrap; word-break: break-word; min-height: 22px; }
.yemr .yemr-ro.is-empty { color: var(--y-t300); }
.yemr .yemr-stars { display: inline-flex; gap: 2px; color: var(--y-warn-bold); }
.yemr .yemr-stars .is-off { color: var(--y-border); }
.yemr .yemr-approval { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--y-divider); }
.yemr .yemr-approval-note { display: flex; align-items: center; gap: 8px; font: 500 14px/20px var(--y-font); color: var(--y-t500); }
.yemr .yemr-approval-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.yemr .yemr-raw-link { align-self: flex-start; }
.yemr .is-saving .yemr-input { opacity: .7; }

/* Responsive: 1366 keeps 5 KPIs; narrower stacks */
@media (max-width: 1180px) {
	.yemr .yemr-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.yemr .yemr-insights { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
	.yemr .yemr-insights > .yemr-card:nth-child(2) { grid-column: 1 / -1; grid-row: 1; }
}
@media (max-width: 760px) {
	.yemr { gap: 12px; }
	.yemr .yemr-card { padding: 16px; }
	.yemr .yemr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
	.yemr .yemr-kpis > :last-child { grid-column: 1 / -1; }
	.yemr .yemr-kpi-value, .yemr .yemr-missing-value { font-size: 26px; line-height: 36px; }
	.yemr .yemr-kpi-label { font-size: 14px; line-height: 20px; }
	.yemr .yemr-insights, .yemr .yemr-grid2 { grid-template-columns: minmax(0, 1fr); }
	.yemr .yemr-insights > .yemr-card:nth-child(2) { grid-column: auto; grid-row: auto; }
	.yemr .yemr-name { font-size: 20px; line-height: 28px; }
	.yemr .yemr-actions { width: 100%; }
	.yemr .yemr-actions > .yemr-btn--primary { flex: 1 1 auto; }
	.yemr .yemr-meta { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
	.yemr .yemr-meta-group { padding: 0; border-left: 0; }
	.yemr .yemr-meta-group:first-child { grid-column: 1 / -1; }
	.yemr .yemr-search { max-width: none; flex-basis: 100%; }
	.yemr .yemr-seg { width: 100%; }
	.yemr .yemr-seg button { flex: 1; justify-content: center; padding: 6px 4px; }
	.yemr .yemr-table-wrap { margin: 0 -16px; max-height: none; }
	.yemr table.yemr-table, .yemr .yemr-table tbody { display: block; }
	.yemr .yemr-table thead { display: none; }
	.yemr .yemr-table tr { display: grid; grid-template-columns: auto 1fr auto; gap: 6px 10px; padding: 12px 16px; border-bottom: 1px solid var(--y-divider); }
	.yemr .yemr-table tbody tr:nth-child(even) td, .yemr .yemr-table tbody tr:hover td { background: none; }
	.yemr .yemr-table tbody tr:nth-child(even) { background: var(--y-subtle); }
	.yemr .yemr-table td { padding: 0 !important; border: 0; display: flex; align-items: center; min-width: 0; }
	.yemr .yemr-table td[data-c="idx"] { display: none; }
	.yemr .yemr-table td[data-c="date"] { grid-column: 1; grid-row: 1; }
	.yemr .yemr-table td[data-c="ticket"] { grid-column: 2; grid-row: 1; }
	.yemr .yemr-table td[data-c="status"] { grid-column: 3; grid-row: 1; justify-content: flex-end; }
	.yemr .yemr-table td[data-c="client"] { grid-column: 1 / -1; }
	.yemr .yemr-table td[data-c="issue"] { grid-column: 1 / -1; min-width: 0; max-width: none; }
	.yemr .yemr-table td[data-c="by"] { grid-column: 1; }
	.yemr .yemr-table td[data-c="time"] { grid-column: 2; }
	.yemr .yemr-table td[data-c="time"]::before { content: "Time "; color: var(--y-t300); margin-right: 4px; }
	.yemr .yemr-table td[data-c="cost"] { grid-column: 3; justify-content: flex-end; }
	.yemr .yemr-split { flex-direction: column; align-items: stretch; }
	.yemr .yemr-donut { margin: 0 auto; }
}

/* Wide screens: let the cards breathe */
@media (min-width: 1500px) {
	.yemr { gap: 20px; }
	.yemr .yemr-card { padding: 28px; }
	.yemr .yemr-kpis, .yemr .yemr-insights, .yemr .yemr-grid2 { gap: 20px; }
	.yemr .yemr-table-wrap { margin: 0 -28px; }
	.yemr .yemr-table th:first-child, .yemr .yemr-table td:first-child { padding-left: 28px; }
	.yemr .yemr-table th:last-child, .yemr .yemr-table td:last-child { padding-right: 28px; }
}

/* Full-width desk page. Scoped to the page-container this script tags (data-yemr-wide),
   i.e. only the Engineer Monthly Report form page; other doctypes keep Frappe's width.
   Frappe 16 centers every .section-body at 900px - lift that cap on this page only.
   The page itself goes white (dark: #141414) so the cards sit directly on it, Figma-style. */
.page-container[data-yemr-wide],
.page-container[data-yemr-wide] .page-body { background: #ffffff; }
[data-theme="dark"] .page-container[data-yemr-wide],
[data-theme="dark"] .page-container[data-yemr-wide] .page-body { background: #141414; }
.page-container[data-yemr-wide] .container { max-width: 100%; }
.page-container[data-yemr-wide] .form-section .section-body { max-width: none; margin-left: 0; margin-right: 0; }
.page-container[data-yemr-wide] .yemr-section,
.page-container[data-yemr-wide] .yemr-section > .section-body { background: transparent; border: 0; box-shadow: none; padding-top: 0; padding-bottom: 0; }
@media (min-width: 992px) {
	.page-container[data-yemr-wide] .container { padding-left: 20px; padding-right: 20px; }
}
`;

	// ---------- icons (24px stroke, currentColor) ----------
	const P = {
		works: '<path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 12h18"/>',
		resolved: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
		clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
		visit: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
		cost: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5"/>',
		word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m8.5 12 1.2 5 1.3-3.5 1.3 3.5 1.2-5"/>',
		refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
		more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
		cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
		send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
		check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
		undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
		users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>',
		save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
		alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
		ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
		trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
		sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
		star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
		chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
	};
	const icon = (name, size = 20, sw = 1.6) =>
		`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

	// ---------- helpers ----------
	const esc = (v) => String(v === null || v === undefined ? "" : v)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	const t = (s, a) => (typeof __ === "function" ? __(s, a) : s);
	const ymd = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? [+m[1], +m[2], +m[3]] : null; };
	const pad = (n) => String(n).padStart(2, "0");
	const dShort = (d) => { const p = ymd(d); return p ? `${pad(p[2])} ${MONTHS[p[1] - 1]}` : ""; };
	const dLong = (d) => { const p = ymd(d); return p ? `${pad(p[2])} ${MONTHS[p[1] - 1]} ${p[0]}` : ""; };
	const int = (v) => (v === null || v === undefined || v === "" ? 0 : parseInt(v, 10) || 0);
	const num = (v) => (v === null || v === undefined || v === "" ? 0 : parseFloat(v) || 0);
	const money = (v) => "$" + num(v).toLocaleString("en-US", { minimumFractionDigits: num(v) % 1 ? 2 : 0, maximumFractionDigits: 2 });
	const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
	const hasRole = (r) => !!(frappe.user && frappe.user.has_role && frappe.user.has_role(r));
	const isManager = () => frappe.session.user === "Administrator" || hasRole("Agent Manager") || hasRole("System Manager");
	const solvedGroup = (v) => (v === "Visit" ? "visit" : v === "WhatsApp" || v === "Remote" ? "remote" : v === "Office" ? "office" : "");
	const getRow = (cdt, cdn) => (frappe.get_doc ? frappe.get_doc(cdt, cdn) : (window.locals && locals[cdt] && locals[cdt][cdn]));

	function periodText(doc) {
		const a = ymd(doc.from_date), b = ymd(doc.to_date);
		if (!a || !b) return t("No period");
		if (doc.period_type === "Month" && a[0] === b[0] && a[1] === b[1]) return `${MONTHS_LONG[a[1] - 1]} ${a[0]}`;
		const left = a[0] === b[0] ? `${pad(a[2])} ${MONTHS[a[1] - 1]}` : dLong(doc.from_date);
		return `${left} → ${dLong(doc.to_date)}`;
	}
	function whenText(dt) {
		if (!dt) return t("Never");
		const m = String(dt).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
		if (!m) return esc(dt);
		const s = `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}, ${m[4]}:${m[5]}`;
		let rel = "";
		try { if (frappe.datetime && frappe.datetime.comment_when) rel = $("<div>").html(frappe.datetime.comment_when(dt)).text(); } catch (e) { rel = ""; }
		return rel ? `${s} · ${rel}` : s;
	}

	// ---------- permissions (mirror B + Server Script "Engineer Monthly Report Validate") ----------
	function perms(frm) {
		const d = frm.doc, status = d.status || "Draft", mgr = isManager();
		const owner = d.engineer === frappe.session.user;
		const editable = !frm.is_new() && d.docstatus === 0 && ((status === "Draft" && (owner || mgr)) || (mgr && status !== "Approved"));
		return {
			status, mgr, owner, editable,
			canHead: mgr && status !== "Approved" && d.docstatus === 0,
			canEngComment: editable && !!(frm.fields_dict && frm.fields_dict.engineer_comment),
			canRefresh: !frm.is_new() && status !== "Approved" && (status === "Draft" || mgr),
			canSubmit: !frm.is_new() && status === "Draft" && (owner || mgr),
			canApprove: !frm.is_new() && status === "Submitted" && mgr,
		};
	}

	// ---------- actions: reuse B / C (window.yool_emr.*), else click their toolbar button ----------
	const ACTIONS = {
		pdf: ["download_pdf", "Download PDF"],
		word: ["download_word", "Download Word"],
		refresh: ["refresh_data", "Refresh data"],
		submit: ["submit", "Submit for approval"],
		approve: ["approve", "Approve"],
		draft: ["send_back", "Send back to Draft"],
		generate: ["generate_all", "Generate for all agents"],
	};
	async function runAction(frm, key) {
		const [fn, label] = ACTIONS[key];
		await flushAll(frm);
		if (key === "approve" && !String(frm.doc.head_comment || "").trim()) {
			frappe.show_alert({ message: t("Write the Head of Technical Team comment first."), indicator: "orange" });
			const el = root(frm) && root(frm).querySelector('[data-key="head_comment"]');
			if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
			return;
		}
		if (typeof NS[fn] === "function") return NS[fn](frm);
		const btn = frm.custom_buttons && (frm.custom_buttons[t(label)] || frm.custom_buttons[label]);
		if (btn && btn.length) { btn.get(0).click(); return; }
		frappe.msgprint({ title: t("Not available"), message: t("The action \"{0}\" is not available for this report.", [t(label)]), indicator: "orange" });
	}

	function hideToolbarDuplicates(frm) {
		if (!HIDE_TOOLBAR_DUPLICATES || !frm.custom_buttons) return;
		Object.values(ACTIONS).forEach(([, label]) => {
			const b = frm.custom_buttons[t(label)] || frm.custom_buttons[label];
			if (b && b.addClass) b.addClass("hidden");
		});
		try {
			const grp = frm.page && frm.page.get_inner_group_button && frm.page.get_inner_group_button(t("Status"));
			if (grp && grp.addClass) grp.addClass("hidden");
		} catch (e) { /* group may not exist */ }
	}

	function toggleRaw(frm, show, scroll = true) {
		state(frm).rawOpen = !!show;
		let found = false;
		RAW_SECTIONS.forEach((fn) => {
			const s = frm.fields_dict && frm.fields_dict[fn];
			if (s && typeof s.collapse === "function") { s.collapse(!show); found = true; }
		});
		if (!show || !scroll) return;
		const first = frm.fields_dict && (frm.fields_dict.advanced_section || frm.fields_dict.engineer);
		const w = first && first.wrapper && (first.wrapper.jquery ? first.wrapper.get(0) : first.wrapper);
		if (w && w.scrollIntoView) w.scrollIntoView({ behavior: "smooth", block: "start" });
		else if (!found && frm.scroll_to_field) frm.scroll_to_field("engineer");
	}

	// ---------- editing: DOM -> model, never lose text ----------
	const state = (frm) => (frm.__yemr = frm.__yemr || { filter: "all", q: "", showAll: false, saveTimer: null, saving: false });
	const root = (frm) => { const f = frm.fields_dict && frm.fields_dict[FIELD]; const w = f && f.$wrapper && f.$wrapper.get(0); return w ? w.querySelector(".yemr") : null; };

	function flushEl(frm, el) {
		// Returns a promise (truthy) when a value was written to the model, else false.
		if (!el || !el.dataset || !el.dataset.field || el.readOnly) return false;
		const v = el.value, f = el.dataset.field, cdt = el.dataset.cdt, cdn = el.dataset.cdn;
		delete el.dataset.dirty;
		if (cdn) {
			const row = getRow(cdt, cdn);
			if (!row || (row[f] || "") === v) return false;
			return frappe.model.set_value(cdt, cdn, f, v) || Promise.resolve();
		}
		if ((frm.doc[f] || "") === v) return false;
		return frm.set_value(f, v) || Promise.resolve();
	}
	function flushAll(frm) {
		// Await the returned promise before anything that reads frm.is_dirty() / saves,
		// so text typed right before an action (no blur yet) is never lost.
		const r = root(frm);
		if (!r) return Promise.resolve();
		const ps = [];
		r.querySelectorAll("[data-field][data-dirty]").forEach((el) => {
			const p = flushEl(frm, el);
			if (p && p.then) ps.push(p);
		});
		return Promise.all(ps);
	}
	function scheduleSave(frm) {
		const st = state(frm);
		clearTimeout(st.saveTimer);
		st.saveTimer = setTimeout(() => autosave(frm), AUTOSAVE_MS);
	}
	async function autosave(frm) {
		const st = state(frm), r = root(frm);
		if (st.saving || frm.is_new() || !frm.is_dirty()) return;
		// Wait while the user is still typing in a field with unflushed text.
		const a = document.activeElement;
		if (r && a && r.contains(a) && a.dataset && a.dataset.dirty) return scheduleSave(frm);
		await flushAll(frm);
		st.saving = true;
		if (r) { r.classList.add("is-saving"); r.querySelectorAll("[data-field]").forEach((el) => (el.readOnly = true)); }
		try { await frm.save(); } catch (e) { /* Frappe shows the error; text stays in the model and the inputs */ }
		finally {
			st.saving = false;
			const r2 = root(frm);
			if (r2) { r2.classList.remove("is-saving"); r2.querySelectorAll("[data-field]:not([data-locked])").forEach((el) => (el.readOnly = false)); }
			updateSaveState(frm);
		}
	}
	function autoGrow(el) {
		if (!el || el.tagName !== "TEXTAREA") return;
		el.style.height = "auto";
		el.style.height = Math.max(64, el.scrollHeight + 2) + "px";
	}
	function updateSaveState(frm) {
		const r = root(frm);
		const el = r && r.querySelector(".yemr-save-state");
		if (!el) return;
		const dirty = frm.is_dirty() || !!r.querySelector("[data-dirty]");
		el.classList.toggle("is-dirty", dirty);
		el.innerHTML = dirty ? `<span class="yemr-dot"></span>${t("Unsaved changes")}` : `${icon("check", 14, 2)}${t("All changes saved")}`;
		const sb = r.querySelector('[data-act="save"]');
		if (sb) sb.hidden = !dirty;
	}

	function addRow(frm, table) {
		const row = frm.add_child(table, table === "challenges" ? { challenge: "", solution: "" } : { client_name: "", feedback: "" });
		frm.refresh_field(table);
		frm.dirty && frm.dirty();
		render(frm);
		const el = root(frm) && root(frm).querySelector(`[data-cdn="${row.name}"]`);
		if (el) el.focus();
	}
	function deleteRow(frm, cdt, cdn, table) {
		const go = () => {
			flushAll(frm);
			frappe.model.clear_doc(cdt, cdn);
			(frm.doc[table] || []).forEach((r, i) => (r.idx = i + 1));
			frm.refresh_field(table);
			frm.dirty && frm.dirty();
			render(frm);
			scheduleSave(frm);
		};
		frappe.confirm ? frappe.confirm(t("Remove this item from the report?"), go) : go();
	}

	// ---------- data shaping ----------
	function model(frm) {
		const d = frm.doc, acts = d.activities || [];
		const works = int(d.works_done) || acts.length;
		const resolved = int(d.issues_resolved);
		const missing = int(d.missing_time_count);
		const by = { office: 0, visit: 0, remote: 0, none: 0 };
		acts.forEach((r) => { by[solvedGroup(r.solved_by) || "none"]++; });
		const counts = {
			all: acts.length,
			done: acts.filter((r) => r.activity_status === "Done").length,
			pending: acts.filter((r) => r.activity_status !== "Done").length,
			visit: acts.filter((r) => r.solved_by === "Visit").length,
		};
		// works per day over the period (capped at 62 days)
		const days = [];
		const a = ymd(d.from_date), b = ymd(d.to_date);
		if (a && b) {
			const start = Date.UTC(a[0], a[1] - 1, a[2]), end = Date.UTC(b[0], b[1] - 1, b[2]);
			for (let x = start, i = 0; x <= end && i < 62; x += 86400000, i++) {
				const dt = new Date(x);
				days.push({ key: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`, day: dt.getUTCDate(), mon: dt.getUTCMonth(), n: 0 });
			}
		}
		const idx = Object.fromEntries(days.map((x, i) => [x.key, i]));
		acts.forEach((r) => { const k = String(r.activity_date || "").slice(0, 10); if (k in idx) days[idx[k]].n++; });
		return { works, resolved, missing, by, counts, days };
	}

	// ---------- render ----------
	function render(frm) {
		const f = frm.fields_dict && frm.fields_dict[FIELD];
		if (!f || !f.$wrapper) return;
		injectStyle();
		const host = f.$wrapper.get(0);
		// Widen this form's desk page only (desk is an SPA: the attribute lives on this
		// doctype's own page-container, so every other page keeps its normal width).
		const pc = host.closest && host.closest(".page-container");
		if (pc) pc.setAttribute("data-yemr-wide", "1");
		// The dashboard's own section loses the card frame (cards sit straight on the page).
		const sect = host.closest && host.closest(".form-section");
		if (sect) sect.classList.add("yemr-section");
		// Keep unsaved text from the old DOM, then remember focus/caret so a re-render never interrupts typing.
		flushAll(frm);
		const a = document.activeElement;
		let focus = null;
		if (a && host.contains(a) && a.dataset && a.dataset.key) {
			focus = { key: a.dataset.key, s: a.selectionStart, e: a.selectionEnd };
		} else if (a && host.contains(a) && a.classList.contains("yemr-q")) {
			focus = { q: true, s: a.selectionStart, e: a.selectionEnd };
		}
		host.innerHTML = frm.is_new() ? htmlNew() : html(frm);
		host.__yemr_frm = frm;
		bind(host);
		host.querySelectorAll("textarea.yemr-input").forEach(autoGrow);
		if (focus) {
			const el = focus.q ? host.querySelector(".yemr-q") : host.querySelector(`[data-key="${focus.key}"]`);
			if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* not a text input */ } }
		}
		updateSaveState(frm);
	}

	function htmlNew() {
		return `<div class="yemr"><div class="yemr-card"><div class="yemr-h" style="margin:0"><div class="yemr-icon-tile">${icon("cal")}</div>
			<div class="yemr-h-text"><p class="yemr-title">${t("New Engineer Monthly Report")}</p>
			<p class="yemr-sub">${t("Choose the Engineer and the period in Advanced / Raw data below, then Save. The dashboard appears after the first save.")}</p></div></div></div></div>`;
	}

	function html(frm) {
		const d = frm.doc, p = perms(frm), m = model(frm), st = state(frm);
		return `<div class="yemr">${header(frm, d, p)}${kpis(m, d)}${insights(m)}${activity(d, m, st)}${challenges(frm, d, p)}${feedback(d, p)}${approval(frm, d, p)}
			<button type="button" class="yemr-btn yemr-btn--ghost yemr-raw-link" data-act="raw">${icon("sliders", 18)}${t("Advanced / Raw data")}</button></div>`;
	}

	function statusPill(s) {
		const cls = s === "Approved" ? "ok" : s === "Submitted" ? "info" : "";
		return `<span class="yemr-pill ${cls ? "yemr-pill--" + cls : ""}"><span class="yemr-dot"></span>${esc(t(s))}</span>`;
	}

	function header(frm, d, p) {
		const name = d.engineer_name || d.engineer || "";
		let img = "";
		try { const ui = frappe.user_info && frappe.user_info(d.engineer); img = ui && ui.image ? ui.image : ""; } catch (e) { img = ""; }
		const menuStatus = [
			p.canSubmit ? `<button type="button" class="yemr-menu-item" data-act="submit">${icon("send", 18)}${t("Submit for approval")}</button>` : "",
			p.canApprove ? `<button type="button" class="yemr-menu-item" data-act="approve">${icon("check", 18)}${t("Approve")}</button>` : "",
			p.canApprove ? `<button type="button" class="yemr-menu-item" data-act="draft">${icon("undo", 18)}${t("Send back to Draft")}</button>` : "",
		].join("");
		const menu = `
			${menuStatus ? `<div class="yemr-eyebrow yemr-menu-label">${t("Status")}</div>${menuStatus}` : `<button type="button" class="yemr-menu-item" disabled>${icon("check", 18)}${t("No status action")}</button>`}
			${p.mgr ? `<div class="yemr-menu-sep"></div><div class="yemr-eyebrow yemr-menu-label">${t("Managers")}</div>
				<button type="button" class="yemr-menu-item" data-act="generate">${icon("users", 18)}${t("Generate for all agents")}</button>` : ""}
			<div class="yemr-menu-sep"></div>
			<button type="button" class="yemr-menu-item" data-act="raw">${icon("sliders", 18)}${t("Advanced / Raw data")}</button>`;
		return `<div class="yemr-card yemr-head">
			<div class="yemr-head-top">
				<div class="yemr-who">
					<div class="yemr-avatar">${img ? `<img src="${esc(img)}" alt="">` : esc(initials(name))}</div>
					<div class="yemr-who-text"><p class="yemr-name">${esc(name)}</p><span class="yemr-email">${esc(d.engineer || "")}</span></div>
				</div>
				<div class="yemr-actions">
					<button type="button" class="yemr-btn yemr-btn--primary" data-act="save" hidden>${icon("save", 18)}${t("Save")}</button>
					<button type="button" class="yemr-btn yemr-btn--primary" data-act="pdf">${icon("pdf")}${t("Download PDF")}</button>
					<button type="button" class="yemr-btn" data-act="word">${icon("word")}${t("Download Word")}</button>
					${p.canRefresh ? `<button type="button" class="yemr-btn" data-act="refresh">${icon("refresh")}${t("Refresh data")}</button>` : ""}
					<div class="yemr-menu-wrap">
						<button type="button" class="yemr-btn yemr-btn--icon" data-act="menu" aria-haspopup="true" aria-label="${t("More actions")}">${icon("more")}</button>
						<div class="yemr-menu" role="menu">${menu}</div>
					</div>
				</div>
			</div>
			<div class="yemr-meta">
				<div class="yemr-meta-group"><span class="yemr-eyebrow">${t("Period")}</span>
					<div class="yemr-meta-row"><span class="yemr-badge">${icon("cal", 16)}${esc(periodText(d))}</span><span class="yemr-badge yemr-badge--brand">${esc(t(d.period_type || "Month"))}</span></div></div>
				<div class="yemr-meta-group"><span class="yemr-eyebrow">${t("Status")}</span><div class="yemr-meta-row">${statusPill(p.status)}</div></div>
				<div class="yemr-meta-group"><span class="yemr-eyebrow">${t("Last refreshed")}</span><div class="yemr-meta-row">${icon("clock", 16)}<span>${esc(whenText(d.last_refreshed))}</span></div></div>
				<div class="yemr-meta-group"><span class="yemr-eyebrow">${t("Report")}</span><div class="yemr-meta-row"><span>${esc(d.name)}</span><span class="yemr-save-state"></span></div></div>
			</div>
		</div>`;
	}

	function kpi(label, value, ico, foot) {
		return `<div class="yemr-card yemr-kpi"><div class="yemr-kpi-top"><span class="yemr-kpi-label">${label}</span><span class="yemr-icon-tile">${icon(ico)}</span></div>
			<div class="yemr-kpi-value">${value}</div><div class="yemr-kpi-foot">${foot || ""}</div></div>`;
	}
	function kpis(m, d) {
		const pct = m.works ? Math.round((m.resolved / m.works) * 100) : 0;
		const visits = m.counts.visit;
		return `<div class="yemr-kpis">
			${kpi(t("Works Done"), m.works, "works", t("tickets in this period"))}
			${kpi(t("Issues Resolved"), m.resolved, "resolved", `<span class="is-up">${icon("trend", 14, 2)}${pct}%</span>${t("of total works")}`)}
			${kpi(t("New Clients"), int(d.new_clients), "clients", t("first ticket in period"))}
			${kpi(t("Clients Visited"), int(d.clients_visited), "visit", visits ? t("{0} visit tickets", [visits]) : t("no on-site visits"))}
			${kpi(t("Total Visit Cost"), money(d.total_visit_cost), "cost", t("sum of visit costs"))}
		</div>`;
	}

	function insights(m) {
		// Missing time
		const ratio = m.works ? m.missing / m.works : 0;
		const tone = m.missing === 0 ? "ok" : ratio >= 1 ? "err" : "warn";
		const barCls = tone === "ok" ? "" : tone === "err" ? "is-err" : "is-warn";
		const width = m.missing === 0 ? 100 : Math.max(4, Math.round(ratio * 100));
		const missingCard = `<div class="yemr-card">
			<div class="yemr-h" style="margin-bottom:12px"><div class="yemr-h-text"><p class="yemr-title">${t("Missing Time Spent")}</p></div><span class="yemr-icon-tile">${icon("clock")}</span></div>
			<div class="yemr-missing-value">${m.missing}<small>/ ${m.works} ${t("tickets")}</small></div>
			<div class="yemr-progress ${barCls}" role="progressbar" aria-valuenow="${Math.round(ratio * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${width}%"></span></div>
			<div class="yemr-hint ${tone === "ok" ? "is-ok" : tone === "err" ? "is-err" : ""}">${icon(tone === "ok" ? "check" : "alert", 16, 2)}
				<span>${tone === "ok" ? t("Every ticket has Time Spent filled in.") : t("Engineers should fill Time Spent on each ticket.")}</span></div>
		</div>`;

		// Works per day
		const max = Math.max(1, ...m.days.map((x) => x.n));
		const peak = Math.max(...m.days.map((x) => x.n), 0);
		const every = m.days.length > 20 ? 5 : m.days.length > 12 ? 2 : 1;
		const bars = m.days.map((x) => {
			const h = x.n ? Math.max(6, Math.round((x.n / max) * 100)) : 0;
			const cls = x.n === 0 ? "is-zero" : x.n === peak ? "is-peak" : "";
			return `<div class="yemr-bar ${cls}" style="--h:${h}%" data-tip="${esc(`${pad(x.day)} ${MONTHS[x.mon]}: ${x.n} ${x.n === 1 ? t("work") : t("works")}`)}"><i style="height:${h}%"></i></div>`;
		}).join("");
		const axis = m.days.map((x, i) => `<span>${i % every === 0 || i === m.days.length - 1 ? x.day : ""}</span>`).join("");
		const total = m.days.reduce((s, x) => s + x.n, 0);
		const activeDays = m.days.filter((x) => x.n).length;
		const chartCard = `<div class="yemr-card">
			<div class="yemr-h"><div class="yemr-h-text"><p class="yemr-title">${t("Works per day")}</p>
				<p class="yemr-sub">${t("{0} works on {1} of {2} days · peak {3}", [total, activeDays, m.days.length, peak])}</p></div></div>
			${m.days.length ? `<div class="yemr-bars"><div class="yemr-grid" style="top:0"><span>${max}</span></div><div class="yemr-grid" style="top:50%"></div>${bars}</div>
				<div class="yemr-axis">${axis}</div>` : `<div class="yemr-empty">${t("Set From and To dates to see the chart.")}</div>`}
		</div>`;

		// Solved by (Office / Visit / Remote)
		const seg = [
			["office", t("Office"), m.by.office],
			["visit", t("Visit"), m.by.visit],
			["remote", t("Remote"), m.by.remote],
		];
		const sum = seg.reduce((s, x) => s + x[2], 0);
		const R = 54, C = 2 * Math.PI * R, nonZero = seg.filter((x) => x[2] > 0).length;
		let off = 0;
		const gap = nonZero > 1 ? 3 : 0;
		const arcs = seg.filter((x) => x[2] > 0).map((x) => {
			const len = (x[2] / sum) * C;
			const a = `<circle r="${R}" cx="66" cy="66" fill="none" stroke="var(--y-c-${x[0]})" stroke-width="14" stroke-dasharray="${Math.max(0.1, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"><title>${esc(x[1])}: ${x[2]}</title></circle>`;
			off += len;
			return a;
		}).join("");
		const legend = seg.map((x) => `<div class="yemr-legend-row"><span class="yemr-swatch" style="background:var(--y-c-${x[0]})"></span><span class="yemr-lg-name"${x[0] === "remote" ? ` title="${t("WhatsApp")}"` : ""}>${esc(x[1])}</span>
			<strong>${x[2]}</strong><span class="yemr-lg-pct">${sum ? Math.round((x[2] / sum) * 100) : 0}%</span></div>`).join("");
		const splitCard = `<div class="yemr-card">
			<div class="yemr-h"><div class="yemr-h-text"><p class="yemr-title">${t("Solved by")}</p><p class="yemr-sub">${m.by.none ? t("{0} without a value · Remote = WhatsApp", [m.by.none]) : t("Remote = WhatsApp support")}</p></div></div>
			<div class="yemr-split"><div class="yemr-donut"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
				<circle r="${R}" cx="66" cy="66" fill="none" stroke="var(--y-hover)" stroke-width="14"/>${arcs}</svg>
				<div class="yemr-donut-c"><strong>${sum}</strong><span>${t("tickets")}</span></div></div>
				<div class="yemr-legend">${legend}</div></div>
		</div>`;
		return `<div class="yemr-insights">${missingCard}${chartCard}${splitCard}</div>`;
	}

	function filteredRows(d, st) {
		const q = st.q.trim().toLowerCase();
		return (d.activities || []).filter((r) => {
			if (st.filter === "done" && r.activity_status !== "Done") return false;
			if (st.filter === "pending" && r.activity_status === "Done") return false;
			if (st.filter === "visit" && r.solved_by !== "Visit") return false;
			if (!q) return true;
			return [r.ticket, r.client_name, r.issue, r.solved_by, r.activity_status].some((v) => String(v || "").toLowerCase().includes(q));
		});
	}
	function rowsHtml(d, st) {
		const rows = filteredRows(d, st);
		const shown = st.showAll ? rows : rows.slice(0, ROWS_PER_PAGE);
		const body = shown.map((r, i) => {
			const g = solvedGroup(r.solved_by);
			const chip = g ? `<span class="yemr-chip yemr-chip--${g}"><i></i>${esc(r.solved_by)}</span>` : `<span class="yemr-muted">—</span>`;
			const time = r.time_spent_text && r.time_spent_text !== "—" ? `<span style="color:var(--y-t900);font-variant-numeric:tabular-nums">${esc(r.time_spent_text)}</span>` : `<span class="yemr-muted">—</span>`;
			const done = r.activity_status === "Done";
			const cost = num(r.visit_cost) ? money(r.visit_cost) : `<span class="yemr-muted">—</span>`;
			const ticket = r.ticket ? `<a class="yemr-tlink" href="/helpdesk/tickets/${encodeURIComponent(r.ticket)}" target="_blank" rel="noopener">#${esc(r.ticket)}${icon("ext", 12, 2)}</a>` : `<span class="yemr-muted">—</span>`;
			return `<tr><td data-c="idx" class="yemr-muted is-num" style="text-align:left">${i + 1}</td><td data-c="date" class="yemr-date">${esc(dShort(r.activity_date))}</td><td data-c="ticket">${ticket}</td>
				<td data-c="client" class="yemr-client">${esc(r.client_name || "—")}</td><td data-c="issue" class="yemr-issue">${esc(r.issue || "")}</td>
				<td data-c="by">${chip}</td><td data-c="time" class="is-num">${time}</td>
				<td data-c="status"><span class="yemr-pill yemr-pill--${done ? "ok" : "warn"}">${esc(t(r.activity_status || "Pending"))}</span></td><td data-c="cost" class="is-num">${cost}</td></tr>`;
		}).join("");
		const foot = rows.length > ROWS_PER_PAGE
			? `<span>${t("Showing {0} of {1}", [shown.length, rows.length])}</span><button type="button" class="yemr-btn yemr-btn--sm" data-act="showall">${st.showAll ? t("Show first {0}", [ROWS_PER_PAGE]) : t("Show all {0}", [rows.length])}</button>`
			: `<span>${t("{0} activities", [rows.length])}</span>`;
		return {
			body: body || `<tr><td colspan="9"><div class="yemr-empty">${(d.activities || []).length ? t("No activity matches this filter.") : t("No tickets in this period yet. Use Refresh data to pull them.")}</div></td></tr>`,
			foot,
		};
	}
	function activity(d, m, st) {
		const seg = [["all", t("All"), m.counts.all], ["done", t("Done"), m.counts.done], ["pending", t("Pending"), m.counts.pending], ["visit", t("Visit"), m.counts.visit]]
			.map(([k, l, n]) => `<button type="button" class="${st.filter === k ? "is-active" : ""}" data-filter="${k}">${l}<em>${n}</em></button>`).join("");
		const r = rowsHtml(d, st);
		return `<div class="yemr-card">
			<div class="yemr-h" style="margin-bottom:16px"><div class="yemr-h-text"><p class="yemr-title">${t("Activity Log")}</p><p class="yemr-sub">${t("Every ticket the engineer worked on in this period")}</p></div></div>
			<div class="yemr-toolbar"><label class="yemr-search">${icon("search", 18)}<input class="yemr-q" type="search" placeholder="${t("Search ticket, client or issue")}" value="${esc(st.q)}"></label>
				<div class="yemr-seg" role="tablist">${seg}</div></div>
			<div class="yemr-table-wrap"><table class="yemr-table"><thead><tr><th>#</th><th>${t("Date")}</th><th>${t("Ticket")}</th><th>${t("Client")}</th><th>${t("Issue")}</th>
				<th>${t("Solved by")}</th><th class="is-num">${t("Time")}</th><th>${t("Status")}</th><th class="is-num">${t("Visit cost")}</th></tr></thead>
				<tbody class="yemr-tbody">${r.body}</tbody></table></div>
			<div class="yemr-table-foot">${r.foot}</div>
		</div>`;
	}

	function editBox(o) {
		// o: {key, field, cdt, cdn, value, editable, placeholder, multiline, label}
		const attrs = `data-key="${esc(o.key)}" data-field="${esc(o.field)}"${o.cdt ? ` data-cdt="${esc(o.cdt)}" data-cdn="${esc(o.cdn)}"` : ""}`;
		const ctl = !o.editable
			? `<div class="yemr-ro ${o.value ? "" : "is-empty"}">${o.value ? esc(o.value) : esc(o.empty || t("Nothing written yet"))}</div>`
			: o.multiline === false
				? `<input class="yemr-input" ${attrs} value="${esc(o.value || "")}" placeholder="${esc(o.placeholder || "")}">`
				: `<textarea class="yemr-input" rows="2" ${attrs} placeholder="${esc(o.placeholder || "")}">${esc(o.value || "")}</textarea>`;
		return o.label ? `<div class="yemr-field"><span class="yemr-field-label">${o.label}</span>${ctl}</div>` : ctl;
	}

	function challenges(frm, d, p) {
		const rows = d.challenges || [];
		const cards = rows.map((r, i) => `<div class="yemr-item">
			<div class="yemr-item-head"><span class="yemr-num">#${i + 1}</span>
				${r.suggested ? `<span class="yemr-badge yemr-badge--warn">${icon("star", 14, 2)}${t("Suggested")}</span>` : ""}
				${r.source_ticket ? `<a class="yemr-tlink" href="/helpdesk/tickets/${encodeURIComponent(r.source_ticket)}" target="_blank" rel="noopener">#${esc(r.source_ticket)}</a>` : ""}
				<span class="yemr-grow"></span>
				${p.editable ? `<button type="button" class="yemr-btn yemr-btn--ghost yemr-btn--icon yemr-btn--danger" data-act="del" data-cdt="${esc(r.doctype)}" data-cdn="${esc(r.name)}" data-table="challenges" aria-label="${t("Delete")}" title="${t("Delete")}">${icon("trash", 18)}</button>` : ""}
			</div>
			${editBox({ key: r.name + ":challenge", field: "challenge", cdt: r.doctype, cdn: r.name, value: r.challenge, editable: p.editable, label: t("Challenge"), placeholder: t("What was difficult?") })}
			${editBox({ key: r.name + ":solution", field: "solution", cdt: r.doctype, cdn: r.name, value: r.solution, editable: p.editable, label: t("Solution"), placeholder: t("How was it solved?") })}
		</div>`).join("");
		return `<div class="yemr-card">
			<div class="yemr-h"><div class="yemr-h-text"><p class="yemr-title">${t("Challenges & Solutions")}</p><p class="yemr-sub">${t("Suggested items come from tickets that missed their SLA")}</p></div>
				${p.editable ? `<button type="button" class="yemr-btn" data-act="add" data-table="challenges">${icon("plus", 18)}${t("Add")}</button>` : ""}</div>
			${rows.length ? `<div class="yemr-grid2">${cards}</div>` : `<div class="yemr-empty">${t("No challenges recorded.")}</div>`}
		</div>`;
	}

	function stars(rating) {
		const v = num(rating);
		if (!v) return "";
		const n = Math.round(v <= 1 ? v * 5 : v);
		let s = "";
		for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? "" : "is-off"}">${icon("star", 16, 0).replace('fill="none"', 'fill="currentColor"')}</span>`;
		return `<span class="yemr-stars" title="${n}/5">${s}</span>`;
	}
	function feedback(d, p) {
		const rows = d.feedback || [];
		const cards = rows.map((r) => `<div class="yemr-item">
			<div class="yemr-item-head">
				${p.editable && !r.client_name ? `<div style="flex:1;min-width:0">${editBox({ key: r.name + ":client_name", field: "client_name", cdt: r.doctype, cdn: r.name, value: r.client_name, editable: true, multiline: false, placeholder: t("Client name") })}</div>`
					: `<span class="yemr-client" style="font:600 16px/24px var(--y-font);color:var(--y-t900)">${esc(r.client_name || t("Client"))}</span>`}
				${stars(r.rating)}
				${r.ticket ? `<a class="yemr-tlink" href="/helpdesk/tickets/${encodeURIComponent(r.ticket)}" target="_blank" rel="noopener">#${esc(r.ticket)}</a>` : ""}
				<span class="yemr-grow"></span>
				${p.editable ? `<button type="button" class="yemr-btn yemr-btn--ghost yemr-btn--icon yemr-btn--danger" data-act="del" data-cdt="${esc(r.doctype)}" data-cdn="${esc(r.name)}" data-table="feedback" aria-label="${t("Delete")}" title="${t("Delete")}">${icon("trash", 18)}</button>` : ""}
			</div>
			${editBox({ key: r.name + ":feedback", field: "feedback", cdt: r.doctype, cdn: r.name, value: r.feedback, editable: p.editable, placeholder: t("What did the client say?") })}
		</div>`).join("");
		return `<div class="yemr-card">
			<div class="yemr-h"><div class="yemr-h-text"><p class="yemr-title">${t("Client Feedback")}</p><p class="yemr-sub">${t("What clients said about the work")}</p></div>
				${p.editable ? `<button type="button" class="yemr-btn" data-act="add" data-table="feedback">${icon("plus", 18)}${t("Add")}</button>` : ""}</div>
			${rows.length ? `<div class="yemr-grid2">${cards}</div>` : `<div class="yemr-empty">${t("No client feedback recorded.")}</div>`}
		</div>`;
	}

	function approval(frm, d, p) {
		const hasEng = !!(frm.fields_dict && frm.fields_dict.engineer_comment);
		const eng = hasEng
			? editBox({ key: "engineer_comment", field: "engineer_comment", value: d.engineer_comment, editable: p.canEngComment, placeholder: t("Summary of the period, blockers, requests…"), empty: t("No comment from the engineer.") })
			: `<div class="yemr-ro is-empty">${t("Field engineer_comment is not installed yet.")}</div>`;
		const head = editBox({ key: "head_comment", field: "head_comment", value: d.head_comment, editable: p.canHead, placeholder: t("Required before approval"), empty: t("Waiting for the Head of Technical Team.") });
		let note = "", actions = "";
		if (p.status === "Draft") {
			note = `${statusPill("Draft")}<span>${p.canSubmit ? t("When the report is complete, submit it to the Agent Manager.") : t("The engineer has not submitted this report yet.")}</span>`;
			if (p.canSubmit) actions = `<button type="button" class="yemr-btn yemr-btn--primary" data-act="submit">${icon("send", 18)}${t("Submit for approval")}</button>`;
		} else if (p.status === "Submitted") {
			note = `${statusPill("Submitted")}<span>${p.canApprove ? t("Review the report, write the Head comment and approve.") : t("Waiting for approval by the Agent Manager.")}</span>`;
			if (p.canApprove) actions = `<button type="button" class="yemr-btn" data-act="draft">${icon("undo", 18)}${t("Send back to Draft")}</button>
				<button type="button" class="yemr-btn yemr-btn--primary" data-act="approve">${icon("check", 18)}${t("Approve")}</button>`;
		} else {
			note = `${statusPill("Approved")}<span>${t("This report is approved and locked.")}</span>`;
		}
		return `<div class="yemr-card">
			<div class="yemr-h"><div class="yemr-h-text"><p class="yemr-title">${t("Comments & approval")}</p></div></div>
			<div class="yemr-grid2">
				<div class="yemr-item"><div class="yemr-item-head"><span class="yemr-eyebrow">${t("Engineer comment")}</span></div>${eng}</div>
				<div class="yemr-item"><div class="yemr-item-head"><span class="yemr-eyebrow">${t("Head of Technical Team")}</span><span class="yemr-grow"></span>
					${p.canHead ? "" : `<span class="yemr-badge">${t("Managers only")}</span>`}</div>${head}</div>
			</div>
			<div class="yemr-approval"><div class="yemr-approval-note">${note}</div><div class="yemr-approval-actions">${actions}</div></div>
		</div>`;
	}

	// ---------- events (delegated, bound once per wrapper) ----------
	function bind(host) {
		if (host.__yemr_bound) return;
		host.__yemr_bound = true;
		const frmOf = () => host.__yemr_frm;
		host.addEventListener("click", (e) => {
			const frm = frmOf();
			const fb = e.target.closest("[data-filter]");
			if (fb) { const st = state(frm); st.filter = fb.dataset.filter; st.showAll = false; refreshTable(frm); return; }
			const b = e.target.closest("[data-act]");
			if (!b || b.disabled) return;
			const act = b.dataset.act, menu = host.querySelector(".yemr-menu");
			if (act === "menu") { menu && menu.classList.toggle("is-open"); return; }
			if (menu) menu.classList.remove("is-open");
			if (act === "showall") { const st = state(frm); st.showAll = !st.showAll; refreshTable(frm); return; }
			if (act === "raw") return toggleRaw(frm, true);
			if (act === "add") return addRow(frm, b.dataset.table);
			if (act === "del") return deleteRow(frm, b.dataset.cdt, b.dataset.cdn, b.dataset.table);
			if (act === "save") { flushAll(frm); return frm.save(); }
			if (ACTIONS[act]) return runAction(frm, act);
		});
		host.addEventListener("input", (e) => {
			const frm = frmOf(), el = e.target;
			if (el.classList.contains("yemr-q")) {
				const st = state(frm); st.q = el.value; st.showAll = false;
				clearTimeout(st.qTimer); st.qTimer = setTimeout(() => refreshTable(frm), 150);
				return;
			}
			if (el.dataset && el.dataset.field) { el.dataset.dirty = "1"; autoGrow(el); updateSaveState(frm); }
		});
		host.addEventListener("focusout", (e) => {
			const frm = frmOf(), el = e.target;
			if (el.dataset && el.dataset.field && el.dataset.dirty) { flushEl(frm, el); scheduleSave(frm); updateSaveState(frm); }
		});
		host.addEventListener("keydown", (e) => {
			if (e.key === "Escape") { const m = host.querySelector(".yemr-menu.is-open"); if (m) m.classList.remove("is-open"); }
		});
	}
	function refreshTable(frm) {
		const r = root(frm);
		if (!r) return;
		const st = state(frm), out = rowsHtml(frm.doc, st);
		r.querySelector(".yemr-tbody").innerHTML = out.body;
		r.querySelector(".yemr-table-foot").innerHTML = out.foot;
		r.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === st.filter));
	}
	if (!window.__yemr_doc_click) {
		window.__yemr_doc_click = true;
		document.addEventListener("click", (e) => {
			document.querySelectorAll(".yemr .yemr-menu.is-open").forEach((m) => { if (!m.parentElement.contains(e.target)) m.classList.remove("is-open"); });
		});
	}

	function injectStyle() {
		if (!document.getElementById(STYLE_ID)) {
			const s = document.createElement("style");
			s.id = STYLE_ID;
			s.textContent = CSS;
			document.head.appendChild(s);
		}
		if (!document.getElementById("yemr-font") && !document.querySelector('link[href*="family=Manrope"]')) {
			const l = document.createElement("link");
			l.id = "yemr-font";
			l.rel = "stylesheet";
			l.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap";
			document.head.appendChild(l);
		}
	}

	UI.render = render;
	UI.flush = flushAll;

	frappe.ui.form.on(DOCTYPE, {
		refresh(frm) {
			if (!frm.fields_dict || !frm.fields_dict[FIELD]) return;
			render(frm);
			if (!frm.is_new()) {
				// B/C add their buttons in their own refresh handlers; hide duplicates after they ran.
				setTimeout(() => hideToolbarDuplicates(frm), 0);
				toggleRaw(frm, !!state(frm).rawOpen, false);
			} else {
				toggleRaw(frm, true, false);
			}
		},
		// Keep the "Unsaved changes" indicator honest when the raw fields are edited directly.
		validate(frm) { flushAll(frm); },
		after_save(frm) { updateSaveState(frm); },
	});
})();
