// Client Script: "Team Monthly Report Dashboard"  (DocType: Team Monthly Report, Apply To: Form, Enabled)
// Renders a dashboard into the HTML field "ui_dashboard" (first field of the form). The real fields stay in
// the collapsed "Advanced / Raw data" sections below, so saving, permissions, Print and Word keep working.
// Edits write to the real fields / child rows (frm.set_value, frappe.model.set_value, frm.add_child) and are
// saved when the user leaves the field (or Save / Ctrl+S). Actions reuse the functions exposed by the
// "Team Monthly Report Form" script on window.yool_tmr; download_pdf / download_word are installed by the
// Downloads script (C2) — the download buttons stay hidden while those functions are not defined.
// Visual language: Figma "UI-dinsg" (kkmiC7lB8fcrjDcpTrW160) — Manrope, #1db487, square corners.
// All CSS is scoped under .ytmr; the full-width hook is the data-ytmr-wide attribute (same trick as EMR).
(() => {
	const DOCTYPE = "Team Monthly Report";
	const FIELD = "ui_dashboard";
	const STYLE_ID = "ytmr-style";
	const ROWS_PER_PAGE = 15;
	const AUTOSAVE_MS = 900;
	const HIDE_TOOLBAR_DUPLICATES = true;
	const RAW_SECTIONS = ["advanced_section", "people_section", "text_section", "summary_section",
		"issues_section", "customers_section", "engineers_section", "challenges_section", "feedback_section", "emr_section"];
	const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	const NS = (window.yool_tmr = window.yool_tmr || {});
	const UI = (NS.ui = NS.ui || {});

	// ---------- CSS (Figma tokens; dark mode = Desk dark surfaces, same roles) ----------
	const CSS = `
.ytmr {
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
	--y-shadow: 0 8px 32px -2px rgba(16, 24, 32, 0.08);
	font-family: var(--y-font); color: var(--y-t900); background: transparent;
	padding: 0; margin: 0 0 8px; display: flex; flex-direction: column; gap: 16px;
	-webkit-font-smoothing: antialiased; box-sizing: border-box; min-width: 0;
}
[data-theme="dark"] .ytmr {
	--y-canvas: #141414; --y-card: #1f1f1f; --y-subtle: #232323; --y-hover: #2a2a2a;
	--y-border: #343434; --y-divider: #2a2a2a; --y-axis: #5c5c5c;
	--y-t900: #f5f5f5; --y-t500: #b4b4b4; --y-t300: #808080;
	--y-brand-soft: rgba(29, 180, 135, 0.16); --y-brand-text: #6ee8c3; --y-brand-border: rgba(110, 232, 195, 0.35);
	--y-bar: #3a3a3a;
	--y-ok-bg: rgba(19, 161, 14, 0.16); --y-ok-text: #7ad277; --y-ok-border: rgba(122, 210, 119, 0.35);
	--y-warn-bg: rgba(250, 146, 0, 0.14); --y-warn-text: #fdb022; --y-warn-border: rgba(253, 176, 34, 0.35);
	--y-err-bg: rgba(209, 52, 56, 0.16); --y-err-text: #f08b8e; --y-err-border: rgba(240, 139, 142, 0.35);
	--y-info-bg: rgba(19, 99, 223, 0.18); --y-info-text: #8fb4f5; --y-info-border: rgba(143, 180, 245, 0.35);
	--y-shadow: 0 8px 32px -2px rgba(0, 0, 0, 0.5);
}
.ytmr *, .ytmr *::before, .ytmr *::after { box-sizing: border-box; font-family: inherit; }
.ytmr button { font: inherit; color: inherit; }
.ytmr [hidden] { display: none !important; }
.ytmr .ytmr-card { background: var(--y-card); border: 1px solid var(--y-border); padding: 24px; min-width: 0; position: relative; }
.ytmr .ytmr-h { display: flex; align-items: flex-start; gap: 12px; margin: 0 0 20px; }
.ytmr .ytmr-h-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ytmr .ytmr-title { font: 500 20px/28px var(--y-font); color: var(--y-t900); margin: 0; }
.ytmr .ytmr-sub { font: 500 14px/20px var(--y-font); color: var(--y-t300); margin: 0; }
.ytmr .ytmr-eyebrow { font: 600 12px/18px var(--y-font); letter-spacing: .06em; text-transform: uppercase; color: var(--y-t300); }
.ytmr .ytmr-muted { color: var(--y-t300); }
.ytmr svg { flex: 0 0 auto; display: block; }

/* Buttons */
.ytmr .ytmr-btn { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 16px;
	border-radius: 4px; border: 1px solid var(--y-border); background: var(--y-card); color: var(--y-t900);
	font: 500 14px/20px var(--y-font); cursor: pointer; white-space: nowrap; transition: background .12s, border-color .12s; }
.ytmr .ytmr-btn:hover { background: var(--y-hover); }
.ytmr .ytmr-btn:focus-visible { outline: 2px solid #6ee8c3; outline-offset: 1px; }
.ytmr .ytmr-btn[disabled] { opacity: .5; cursor: default; }
.ytmr .ytmr-btn--primary { background: var(--y-brand); border-color: var(--y-brand); color: #fff; }
.ytmr .ytmr-btn--primary:hover { background: var(--y-brand-hover); border-color: var(--y-brand-hover); }
.ytmr .ytmr-btn--ghost { border-color: transparent; background: transparent; color: var(--y-t500); }
.ytmr .ytmr-btn--ghost:hover { background: var(--y-hover); color: var(--y-t900); }
.ytmr .ytmr-btn--danger { color: var(--y-err-text); }
.ytmr .ytmr-btn--icon { width: 36px; padding: 0; }
.ytmr .ytmr-btn--sm { height: 28px; padding: 4px 10px; font-size: 13px; }

/* Badge / Pill */
.ytmr .ytmr-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 4px; border: 1px solid var(--y-border);
	background: var(--y-card); font: 500 14px/20px var(--y-font); color: var(--y-t500); white-space: nowrap; }
.ytmr .ytmr-badge--brand { border-color: var(--y-brand-border); color: var(--y-brand-text); }
.ytmr .ytmr-badge--warn { border-color: var(--y-warn-border); color: var(--y-warn-text); }
.ytmr .ytmr-pill { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 120px; font: 500 14px/20px var(--y-font);
	white-space: nowrap; background: var(--y-hover); color: var(--y-t500); }
.ytmr .ytmr-pill--ok { background: var(--y-ok-bg); color: var(--y-ok-text); }
.ytmr .ytmr-pill--warn { background: var(--y-warn-bg); color: var(--y-warn-text); }
.ytmr .ytmr-pill--info { background: var(--y-info-bg); color: var(--y-info-text); }
.ytmr .ytmr-pill--brand { background: var(--y-brand-soft); color: var(--y-brand-text); }
.ytmr .ytmr-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* Header card */
.ytmr .ytmr-head { display: flex; flex-direction: column; gap: 20px; }
.ytmr .ytmr-head-top { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.ytmr .ytmr-who { display: flex; align-items: center; gap: 12px; flex: 1 1 260px; min-width: 0; }
.ytmr .ytmr-logo { width: 48px; height: 48px; border-radius: 4px; background: var(--y-brand-soft); color: var(--y-brand-text); flex: 0 0 48px;
	display: flex; align-items: center; justify-content: center; }
.ytmr .ytmr-who-text { min-width: 0; display: flex; flex-direction: column; }
.ytmr .ytmr-name { font: 600 24px/32px var(--y-font); color: var(--y-t900); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ytmr .ytmr-email { font: 400 14px/20px var(--y-font); color: var(--y-t500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ytmr .ytmr-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ytmr .ytmr-meta { display: flex; flex-wrap: wrap; gap: 16px 0; padding-top: 20px; border-top: 1px solid var(--y-divider); }
.ytmr .ytmr-meta-group { display: flex; flex-direction: column; gap: 8px; padding: 0 24px; border-left: 1px solid var(--y-divider); min-width: 0; }
.ytmr .ytmr-meta-group:first-child { padding-left: 0; border-left: 0; }
.ytmr .ytmr-meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 500 14px/20px var(--y-font); color: var(--y-t900); }
.ytmr .ytmr-save-state { font: 500 13px/20px var(--y-font); color: var(--y-t300); display: inline-flex; align-items: center; gap: 6px; }
.ytmr .ytmr-save-state.is-dirty { color: var(--y-warn-text); }

/* Menu */
.ytmr .ytmr-menu-wrap { position: relative; }
.ytmr .ytmr-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 240px; padding: 8px; display: none; flex-direction: column; gap: 2px;
	background: var(--y-card); border: 1px solid var(--y-divider); border-radius: 8px; box-shadow: var(--y-shadow); }
.ytmr .ytmr-menu.is-open { display: flex; }
.ytmr .ytmr-menu-label { padding: 6px 12px 2px; }
.ytmr .ytmr-menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; border: 0; background: none; text-align: left;
	font: 500 14px/20px var(--y-font); color: var(--y-t900); cursor: pointer; white-space: nowrap; }
.ytmr .ytmr-menu-item:hover { background: var(--y-hover); }
.ytmr .ytmr-menu-item[disabled] { color: var(--y-t300); cursor: default; background: none; }
.ytmr .ytmr-menu-sep { height: 1px; background: var(--y-divider); margin: 4px 0; }

/* KPI tiles */
.ytmr .ytmr-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.ytmr .ytmr-kpi { display: flex; flex-direction: column; gap: 4px; transition: box-shadow .15s ease, transform .15s ease; }
.ytmr .ytmr-kpi:hover { box-shadow: var(--y-shadow); transform: translateY(-2px); }
.ytmr .ytmr-kpi-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.ytmr .ytmr-icon-tile { width: 40px; height: 40px; border-radius: 4px; background: var(--y-hover); color: var(--y-t900); display: flex; align-items: center; justify-content: center; }
.ytmr .ytmr-kpi-label { font: 500 16px/24px var(--y-font); color: var(--y-t500); min-width: 0; }
.ytmr .ytmr-kpi-value { font: 600 clamp(32px, 1.4vw + 16px, 42px)/1.3 var(--y-font); color: var(--y-t900); font-variant-numeric: tabular-nums; }
.ytmr .ytmr-kpi-foot { font: 500 13px/20px var(--y-font); color: var(--y-t300); display: flex; align-items: center; gap: 6px; min-height: 20px; }
.ytmr .ytmr-kpi-foot .is-up { color: var(--y-ok-bold); display: inline-flex; align-items: center; gap: 4px; }

/* Summary strip (the docx 3x3 block) */
.ytmr .ytmr-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
.ytmr .ytmr-strip-group { padding: 0 24px; border-left: 1px solid var(--y-divider); display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.ytmr .ytmr-strip-group:first-child { padding-left: 0; border-left: 0; }
.ytmr .ytmr-strip-row { display: flex; gap: 12px; }
.ytmr .ytmr-stat { flex: 1 1 0; min-width: 0; }
.ytmr .ytmr-stat b { display: block; font: 600 24px/32px var(--y-font); color: var(--y-t900); font-variant-numeric: tabular-nums; }
.ytmr .ytmr-stat span { font: 500 13px/18px var(--y-font); color: var(--y-t500); }

/* Insights row: two hbar cards + donut */
.ytmr .ytmr-insights { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }
.ytmr .ytmr-hbars { display: flex; flex-direction: column; gap: 10px; }
.ytmr .ytmr-hbar { display: grid; grid-template-columns: minmax(90px, 170px) 1fr auto; gap: 10px; align-items: center; font: 500 13px/18px var(--y-font); color: var(--y-t500); }
.ytmr .ytmr-hbar .ytmr-hb-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ytmr .ytmr-hb-track { height: 10px; background: var(--y-hover); overflow: hidden; }
.ytmr .ytmr-hb-fill { height: 100%; background: var(--y-bar); }
.ytmr .ytmr-hbar.is-peak .ytmr-hb-fill { background: var(--y-brand); }
.ytmr .ytmr-hbar b { color: var(--y-t900); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* Donut + legend */
.ytmr .ytmr-split { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 20px; }
.ytmr .ytmr-donut { position: relative; width: 140px; height: 140px; flex: 0 0 140px; }
.ytmr .ytmr-donut svg { width: 100%; height: 100%; }
.ytmr .ytmr-donut-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ytmr .ytmr-donut-c strong { font: 600 24px/32px var(--y-font); }
.ytmr .ytmr-donut-c span { font: 500 12px/16px var(--y-font); color: var(--y-t300); }
.ytmr .ytmr-legend { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column; }
.ytmr .ytmr-legend-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--y-divider); font: 500 14px/20px var(--y-font); color: var(--y-t500); }
.ytmr .ytmr-legend-row:last-child { border-bottom: 0; }
.ytmr .ytmr-swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 10px; }
.ytmr .ytmr-legend-row .ytmr-lg-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ytmr .ytmr-legend-row strong { color: var(--y-t900); font-weight: 600; font-variant-numeric: tabular-nums; }
.ytmr .ytmr-legend-row .ytmr-lg-pct { width: 44px; text-align: right; color: var(--y-t300); font-variant-numeric: tabular-nums; }

/* Tables */
.ytmr .ytmr-table-wrap { overflow-x: auto; border-top: 1px solid var(--y-divider); margin: 0 -24px; }
.ytmr table.ytmr-table { width: 100%; border-collapse: separate; border-spacing: 0; font: 500 14px/20px var(--y-font); }
.ytmr .ytmr-table th { position: sticky; top: 0; z-index: 2; background: var(--y-subtle); text-align: left; padding: 10px 12px;
	font: 600 12px/18px var(--y-font); letter-spacing: .06em; text-transform: uppercase; color: var(--y-t300); border-bottom: 1px solid var(--y-divider); white-space: nowrap; }
.ytmr .ytmr-table td { padding: 10px 12px; border-bottom: 1px solid var(--y-divider); color: var(--y-t500); vertical-align: middle; }
.ytmr .ytmr-table th:first-child, .ytmr .ytmr-table td:first-child { padding-left: 24px; }
.ytmr .ytmr-table th:last-child, .ytmr .ytmr-table td:last-child { padding-right: 24px; }
.ytmr .ytmr-table tbody tr:nth-child(even) td { background: var(--y-subtle); }
.ytmr .ytmr-table tbody tr:hover td { background: var(--y-hover); }
.ytmr .ytmr-table .is-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ytmr .ytmr-table .ytmr-main { color: var(--y-t900); font-weight: 600; }
.ytmr .ytmr-table tr.is-total td { background: var(--y-subtle); color: var(--y-t900); font-weight: 700; border-top: 1px solid var(--y-border); }
.ytmr .ytmr-empty { padding: 32px 24px; text-align: center; color: var(--y-t300); font: 500 14px/20px var(--y-font); }
.ytmr .ytmr-table-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; font: 500 14px/20px var(--y-font); color: var(--y-t300); flex-wrap: wrap; }
.ytmr .ytmr-tlink { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 4px; border: 1px solid var(--y-brand-border);
	background: var(--y-card); color: var(--y-brand-text); font: 600 13px/20px var(--y-font); text-decoration: none; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ytmr .ytmr-tlink:hover { background: var(--y-brand-soft); text-decoration: none; color: var(--y-brand-text); }

/* Text / items / editing */
.ytmr .ytmr-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ytmr .ytmr-item { border: 1px solid var(--y-divider); background: var(--y-subtle); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.ytmr .ytmr-item-head { display: flex; align-items: center; gap: 8px; min-height: 28px; flex-wrap: wrap; }
.ytmr .ytmr-item-head .ytmr-grow { flex: 1; }
.ytmr .ytmr-num { font: 600 14px/20px var(--y-font); color: var(--y-t300); font-variant-numeric: tabular-nums; }
.ytmr .ytmr-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ytmr .ytmr-field-label { font: 500 14px/20px var(--y-font); color: var(--y-t900); }
.ytmr .ytmr-input { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid var(--y-border); border-radius: 8px; background: var(--y-card);
	color: var(--y-t900); font: 500 14px/22px var(--y-font); resize: none; outline: none; overflow: hidden; display: block; }
.ytmr textarea.ytmr-input { min-height: 64px; }
.ytmr .ytmr-input:hover { border-color: var(--y-t300); }
.ytmr .ytmr-input:focus { border-color: #20c997; box-shadow: 0 0 0 3px var(--y-brand-soft); }
.ytmr .ytmr-input::placeholder { color: var(--y-t300); }
.ytmr .ytmr-input[readonly] { background: var(--y-subtle); border-color: var(--y-divider); cursor: default; box-shadow: none; }
.ytmr .ytmr-ro { font: 500 14px/22px var(--y-font); color: var(--y-t900); white-space: pre-wrap; word-break: break-word; min-height: 22px; }
.ytmr .ytmr-ro.is-empty { color: var(--y-t300); }
.ytmr .ytmr-stars { display: inline-flex; gap: 2px; color: var(--y-warn-bold); }
.ytmr .ytmr-stars .is-off { color: var(--y-border); }
.ytmr .ytmr-approval { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--y-divider); }
.ytmr .ytmr-approval-note { display: flex; align-items: center; gap: 8px; font: 500 14px/20px var(--y-font); color: var(--y-t500); }
.ytmr .ytmr-approval-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ytmr .ytmr-raw-link { align-self: flex-start; }
.ytmr .is-saving .ytmr-input { opacity: .7; }
.ytmr .ytmr-chips { display: flex; flex-wrap: wrap; gap: 8px; }

/* Responsive */
@media (max-width: 1180px) {
	.ytmr .ytmr-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.ytmr .ytmr-insights { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
	.ytmr .ytmr-insights > .ytmr-card:nth-child(3) { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
	.ytmr { gap: 12px; }
	.ytmr .ytmr-card { padding: 16px; }
	.ytmr .ytmr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
	.ytmr .ytmr-kpis > :last-child { grid-column: 1 / -1; }
	.ytmr .ytmr-kpi-value { font-size: 26px; line-height: 36px; }
	.ytmr .ytmr-kpi-label { font-size: 14px; line-height: 20px; }
	.ytmr .ytmr-insights, .ytmr .ytmr-grid2 { grid-template-columns: minmax(0, 1fr); }
	.ytmr .ytmr-strip { grid-template-columns: minmax(0, 1fr); gap: 16px; }
	.ytmr .ytmr-strip-group { padding: 0; border-left: 0; }
	.ytmr .ytmr-name { font-size: 20px; line-height: 28px; }
	.ytmr .ytmr-actions { width: 100%; }
	.ytmr .ytmr-meta { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
	.ytmr .ytmr-meta-group { padding: 0; border-left: 0; }
	.ytmr .ytmr-table-wrap { margin: 0 -16px; }
	.ytmr .ytmr-split { flex-direction: column; align-items: stretch; }
	.ytmr .ytmr-donut { margin: 0 auto; }
}
@media (min-width: 1500px) {
	.ytmr { gap: 20px; }
	.ytmr .ytmr-card { padding: 28px; }
	.ytmr .ytmr-kpis, .ytmr .ytmr-insights, .ytmr .ytmr-grid2 { gap: 20px; }
	.ytmr .ytmr-table-wrap { margin: 0 -28px; }
	.ytmr .ytmr-table th:first-child, .ytmr .ytmr-table td:first-child { padding-left: 28px; }
	.ytmr .ytmr-table th:last-child, .ytmr .ytmr-table td:last-child { padding-right: 28px; }
}

/* Full-width desk page, scoped to this doctype's own page-container (same trick as the EMR dashboard). */
.page-container[data-ytmr-wide],
.page-container[data-ytmr-wide] .page-body { background: #ffffff; }
[data-theme="dark"] .page-container[data-ytmr-wide],
[data-theme="dark"] .page-container[data-ytmr-wide] .page-body { background: #141414; }
.page-container[data-ytmr-wide] .container { max-width: 100%; }
.page-container[data-ytmr-wide] .form-section .section-body { max-width: none; margin-left: 0; margin-right: 0; }
.page-container[data-ytmr-wide] .ytmr-section,
.page-container[data-ytmr-wide] .ytmr-section > .section-body { background: transparent; border: 0; box-shadow: none; padding-top: 0; padding-bottom: 0; }
@media (min-width: 992px) {
	.page-container[data-ytmr-wide] .container { padding-left: 20px; padding-right: 20px; }
}
`;

	// ---------- icons ----------
	const P = {
		works: '<path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 12h18"/>',
		resolved: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
		open: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
		cost: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
		clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5"/>',
		word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m8.5 12 1.2 5 1.3-3.5 1.3 3.5 1.2-5"/>',
		refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
		more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
		cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
		send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
		check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
		undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
		users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 4.8"/>',
		save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
		trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
		sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
		star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
		text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
		chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
		doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
		phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
		pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
	};
	const icon = (name, size = 20, sw = 1.6) =>
		`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

	// Donut palette (engineer share)
	const PALETTE = ["#1db487", "#3b6fe0", "#fa9200", "#be2f33", "#115acb", "#8f9193", "#dadadb"];

	// ---------- helpers ----------
	const esc = (v) => String(v === null || v === undefined ? "" : v)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	const t = (s, a) => (typeof __ === "function" ? __(s, a) : s);
	const ymd = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? [+m[1], +m[2], +m[3]] : null; };
	const pad = (n) => String(n).padStart(2, "0");
	const dLong = (d) => { const p = ymd(d); return p ? `${pad(p[2])} ${MONTHS[p[1] - 1]} ${p[0]}` : ""; };
	const int = (v) => (v === null || v === undefined || v === "" ? 0 : parseInt(v, 10) || 0);
	const num = (v) => (v === null || v === undefined || v === "" ? 0 : parseFloat(v) || 0);
	const money = (v) => "$" + num(v).toLocaleString("en-US", { minimumFractionDigits: num(v) % 1 ? 2 : 0, maximumFractionDigits: 2 });
	const getRow = (cdt, cdn) => (frappe.get_doc ? frappe.get_doc(cdt, cdn) : (window.locals && locals[cdt] && locals[cdt][cdn]));
	const htmlToText = (v) => {
		if (!v) return "";
		if (v.indexOf("<") < 0) return v;
		const withBreaks = String(v).replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n");
		const el = document.createElement("div");
		el.innerHTML = withBreaks;
		return (el.textContent || "").trim();
	};

	function periodText(doc) {
		const a = ymd(doc.from_date), b = ymd(doc.to_date);
		if (!a || !b) return t("No period");
		return `${dLong(doc.from_date)} → ${dLong(doc.to_date)}`;
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

	// ---------- permissions (mirror Server Script "Team Monthly Report Validate"; managers only doctype) ----------
	function perms(frm) {
		const d = frm.doc, status = d.status || "Draft";
		const editable = !frm.is_new() && d.docstatus === 0 && status !== "Approved";
		return {
			status, editable,
			canRefresh: !frm.is_new() && status !== "Approved",
			canSubmit: !frm.is_new() && status === "Draft",
			canApprove: !frm.is_new() && status === "Submitted",
		};
	}

	// ---------- actions: reuse the Form script (window.yool_tmr.*), else click its toolbar button ----------
	const ACTIONS = {
		pdf: ["download_pdf", "Download PDF"],
		word: ["download_word", "Download Word"],
		refresh: ["refresh_data", "Refresh data"],
		submit: ["submit", "Submit for approval"],
		approve: ["approve", "Approve"],
		draft: ["send_back", "Send back to Draft"],
	};
	async function runAction(frm, key) {
		const parts = ACTIONS[key];
		await flushAll(frm);
		if (typeof NS[parts[0]] === "function") return NS[parts[0]](frm);
		const btn = frm.custom_buttons && (frm.custom_buttons[t(parts[1])] || frm.custom_buttons[parts[1]]);
		if (btn && btn.length) { btn.get(0).click(); return; }
		frappe.msgprint({ title: t("Not available"), message: t("The action \"{0}\" is not available for this report.", [t(parts[1])]), indicator: "orange" });
	}

	function hideToolbarDuplicates(frm) {
		if (!HIDE_TOOLBAR_DUPLICATES || !frm.custom_buttons) return;
		Object.values(ACTIONS).forEach((a) => {
			const b = frm.custom_buttons[t(a[1])] || frm.custom_buttons[a[1]];
			if (b && b.addClass) b.addClass("hidden");
		});
		try {
			const grp = frm.page && frm.page.get_inner_group_button && frm.page.get_inner_group_button(t("Status"));
			if (grp && grp.addClass) grp.addClass("hidden");
		} catch (e) { /* group may not exist */ }
	}

	function toggleRaw(frm, show, scroll = true) {
		state(frm).rawOpen = !!show;
		RAW_SECTIONS.forEach((fn) => {
			const s = frm.fields_dict && frm.fields_dict[fn];
			if (s && typeof s.collapse === "function") s.collapse(!show);
		});
		if (!show || !scroll) return;
		const first = frm.fields_dict && (frm.fields_dict.advanced_section || frm.fields_dict.period_type);
		const w = first && first.wrapper && (first.wrapper.jquery ? first.wrapper.get(0) : first.wrapper);
		if (w && w.scrollIntoView) w.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	// ---------- editing: DOM -> model, never lose text ----------
	const state = (frm) => (frm.__ytmr = frm.__ytmr || { saveTimer: null, saving: false, show: {} });
	const root = (frm) => { const f = frm.fields_dict && frm.fields_dict[FIELD]; const w = f && f.$wrapper && f.$wrapper.get(0); return w ? w.querySelector(".ytmr") : null; };

	function flushEl(frm, el) {
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
		const el = r && r.querySelector(".ytmr-save-state");
		if (!el) return;
		const dirty = frm.is_dirty() || !!r.querySelector("[data-dirty]");
		el.classList.toggle("is-dirty", dirty);
		el.innerHTML = dirty ? `<span class="ytmr-dot"></span>${t("Unsaved changes")}` : `${icon("check", 14, 2)}${t("All changes saved")}`;
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

	// ---------- render ----------
	function render(frm) {
		const f = frm.fields_dict && frm.fields_dict[FIELD];
		if (!f || !f.$wrapper) return;
		injectStyle();
		const host = f.$wrapper.get(0);
		const pc = host.closest && host.closest(".page-container");
		if (pc) pc.setAttribute("data-ytmr-wide", "1");
		const sect = host.closest && host.closest(".form-section");
		if (sect) sect.classList.add("ytmr-section");
		flushAll(frm);
		const a = document.activeElement;
		let focus = null;
		if (a && host.contains(a) && a.dataset && a.dataset.key) focus = { key: a.dataset.key, s: a.selectionStart, e: a.selectionEnd };
		host.innerHTML = frm.is_new() ? htmlNew() : html(frm);
		host.__ytmr_frm = frm;
		bind(host);
		host.querySelectorAll("textarea.ytmr-input").forEach(autoGrow);
		if (focus) {
			const el = host.querySelector(`[data-key="${focus.key}"]`);
			if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* not a text input */ } }
		}
		updateSaveState(frm);
	}

	function htmlNew() {
		return `<div class="ytmr"><div class="ytmr-card"><div class="ytmr-h" style="margin:0"><div class="ytmr-icon-tile">${icon("cal")}</div>
			<div class="ytmr-h-text"><p class="ytmr-title">${t("New Team Monthly Report")}</p>
			<p class="ytmr-sub">${t("Set the period in Advanced / Raw data below and Save — or use the Generate Team Report button on the Agent Report. The dashboard appears after the first save.")}</p></div></div></div></div>`;
	}

	function html(frm) {
		const d = frm.doc, p = perms(frm);
		return `<div class="ytmr">${header(frm, d, p)}${kpis(d)}${strip(d)}${insights(d)}${nuxur(frm, d, p)}
			${tableIssues(frm, d)}${tableCustomers(frm, d)}${tableEngineers(frm, d)}
			${challenges(frm, d, p)}${feedback(d, p)}${emrLinks(d)}${approval(frm, d, p)}
			<button type="button" class="ytmr-btn ytmr-btn--ghost ytmr-raw-link" data-act="raw">${icon("sliders", 18)}${t("Advanced / Raw data")}</button></div>`;
	}

	function statusPill(s) {
		const cls = s === "Approved" ? "ok" : s === "Submitted" ? "info" : "";
		return `<span class="ytmr-pill ${cls ? "ytmr-pill--" + cls : ""}"><span class="ytmr-dot"></span>${esc(t(s))}</span>`;
	}

	function header(frm, d, p) {
		const hasPdf = typeof NS.download_pdf === "function";
		const hasWord = typeof NS.download_word === "function";
		const menuStatus = [
			p.canSubmit ? `<button type="button" class="ytmr-menu-item" data-act="submit">${icon("send", 18)}${t("Submit for approval")}</button>` : "",
			p.canApprove ? `<button type="button" class="ytmr-menu-item" data-act="approve">${icon("check", 18)}${t("Approve")}</button>` : "",
			p.canApprove ? `<button type="button" class="ytmr-menu-item" data-act="draft">${icon("undo", 18)}${t("Send back to Draft")}</button>` : "",
		].join("");
		const menu = `
			${menuStatus ? `<div class="ytmr-eyebrow ytmr-menu-label">${t("Status")}</div>${menuStatus}` : `<button type="button" class="ytmr-menu-item" disabled>${icon("check", 18)}${t("No status action")}</button>`}
			<div class="ytmr-menu-sep"></div>
			<button type="button" class="ytmr-menu-item" data-act="raw">${icon("sliders", 18)}${t("Advanced / Raw data")}</button>`;
		return `<div class="ytmr-card ytmr-head">
			<div class="ytmr-head-top">
				<div class="ytmr-who">
					<div class="ytmr-logo">${icon("users", 26)}</div>
					<div class="ytmr-who-text"><p class="ytmr-name">${t("Xafiiska Farsamada")} · ${esc(d.month_label || "")}</p>
					<span class="ytmr-email">${t("Team Monthly Report")} · ${esc(d.name)}</span></div>
				</div>
				<div class="ytmr-actions">
					<button type="button" class="ytmr-btn ytmr-btn--primary" data-act="save" hidden>${icon("save", 18)}${t("Save")}</button>
					${hasPdf ? `<button type="button" class="ytmr-btn ytmr-btn--primary" data-act="pdf">${icon("pdf")}${t("Download PDF")}</button>` : ""}
					${hasWord ? `<button type="button" class="ytmr-btn" data-act="word">${icon("word")}${t("Download Word")}</button>` : ""}
					${p.canRefresh ? `<button type="button" class="ytmr-btn" data-act="refresh">${icon("refresh")}${t("Refresh data")}</button>` : ""}
					<div class="ytmr-menu-wrap">
						<button type="button" class="ytmr-btn ytmr-btn--icon" data-act="menu" aria-haspopup="true" aria-label="${t("More actions")}">${icon("more")}</button>
						<div class="ytmr-menu" role="menu">${menu}</div>
					</div>
				</div>
			</div>
			<div class="ytmr-meta">
				<div class="ytmr-meta-group"><span class="ytmr-eyebrow">${t("Period")}</span>
					<div class="ytmr-meta-row"><span class="ytmr-badge">${icon("cal", 16)}${esc(periodText(d))}</span><span class="ytmr-badge ytmr-badge--brand">${esc(t(d.period_type || "Month"))}</span></div></div>
				<div class="ytmr-meta-group"><span class="ytmr-eyebrow">${t("Status")}</span><div class="ytmr-meta-row">${statusPill(p.status)}</div></div>
				<div class="ytmr-meta-group"><span class="ytmr-eyebrow">${t("Last refreshed")}</span><div class="ytmr-meta-row">${icon("clock", 16)}<span>${esc(whenText(d.last_refreshed))}</span></div></div>
				<div class="ytmr-meta-group"><span class="ytmr-eyebrow">${t("Prepared by")}</span><div class="ytmr-meta-row"><span>${esc(d.prepared_by_name || d.prepared_by || "")}</span><span class="ytmr-save-state"></span></div></div>
			</div>
		</div>`;
	}

	function kpi(label, value, ico, foot) {
		return `<div class="ytmr-card ytmr-kpi"><div class="ytmr-kpi-top"><span class="ytmr-kpi-label">${label}</span><span class="ytmr-icon-tile">${icon(ico)}</span></div>
			<div class="ytmr-kpi-value">${value}</div><div class="ytmr-kpi-foot">${foot || ""}</div></div>`;
	}
	function kpis(d) {
		const total = int(d.total_issues), resolved = int(d.resolved_count);
		const pct = total ? Math.round((resolved / total) * 100) : 0;
		// Customers served = rows with tickets AND a real customer (skips the "Aan la cayimin" bucket row),
		// so the tile always matches the nuxur sentence's "macmiil" count.
		const custs = (d.customer_rows || []).filter((r) => r.customer && int(r.ticket_count) > 0).length;
		return `<div class="ytmr-kpis">
			${kpi(t("Wadarta Ciladaha"), total, "works", t("tickets in this period"))}
			${kpi(t("La Xaliyay"), resolved, "resolved", `<span class="is-up">${icon("trend", 14, 2)}${pct}%</span>${t("of total")}`)}
			${kpi(t("Aan La Xalin"), int(d.unresolved_count), "open", t("still open"))}
			${kpi(t("Kharashaadka"), money(d.total_expense), "cost", t("Bajaaj expense · avg {0} / cilad", [money(d.avg_expense_per_issue)]))}
			${kpi(t("Macaamiisha"), custs, "clients", t("{0} new clients", [int(d.new_clients_count)]))}
		</div>`;
	}

	function strip(d) {
		const stat = (v, l) => `<div class="ytmr-stat"><b>${v}</b><span>${l}</span></div>`;
		return `<div class="ytmr-card">
			<div class="ytmr-strip">
				<div class="ytmr-strip-group"><span class="ytmr-eyebrow">${t("Macaamiisha soo hadashay")}</span>
					<div class="ytmr-strip-row">${stat(int(d.fariin_count), t("Fariin"))}${stat(int(d.wicitaan_count), t("Wicitaan"))}${stat(int(d.booqasho_count), t("Booqasho"))}</div></div>
				<div class="ytmr-strip-group"><span class="ytmr-eyebrow">${t("Shaqooyinka loo qabtay")}</span>
					<div class="ytmr-strip-row">${stat(int(d.new_clients_count), t("Macmiil Cusub"))}${stat(int(d.issues_resolved_count), t("Cilado la xaliyay"))}${stat(int(d.clients_visited_count), t("Macmiil la booqday"))}</div></div>
				<div class="ytmr-strip-group"><span class="ytmr-eyebrow">${t("Ciladaha / Macaamiisha")}</span>
					<div class="ytmr-strip-row">${stat(int(d.total_issues), t("Wadarta"))}${stat(int(d.resolved_count), t("La xaliyay"))}${stat(int(d.unresolved_count), t("Aan la xalin"))}</div></div>
			</div>
		</div>`;
	}

	function hbars(rows, nameKey, valueKey, fmt) {
		const max = Math.max(1, ...rows.map((r) => num(r[valueKey])));
		return `<div class="ytmr-hbars">${rows.map((r, i) => {
			const v = num(r[valueKey]);
			const w = Math.max(2, Math.round((v / max) * 100));
			return `<div class="ytmr-hbar ${i === 0 ? "is-peak" : ""}"><span class="ytmr-hb-name" title="${esc(r[nameKey])}">${esc(r[nameKey])}</span>
				<span class="ytmr-hb-track"><span class="ytmr-hb-fill" style="width:${w}%"></span></span><b>${fmt ? fmt(r) : v}</b></div>`;
		}).join("")}</div>`;
	}

	function insights(d) {
		const issues = (d.issue_rows || []).filter((r) => r.issue_type !== "Lama xirin ticket" && int(r.ticket_count) > 0).slice(0, 12);
		const issueCard = `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Ciladaha nuucyadooda")}</p>
				<p class="ytmr-sub">${t("Top {0} of {1} issue types", [issues.length, (d.issue_rows || []).filter((r) => r.issue_type !== "Lama xirin ticket").length])}</p></div></div>
			${issues.length ? hbars(issues, "issue_type", "ticket_count") : `<div class="ytmr-empty">${t("No data. Use Refresh data.")}</div>`}
		</div>`;

		const custs = (d.customer_rows || []).filter((r) => int(r.ticket_count) > 0)
			.slice().sort((a, b) => int(b.ticket_count) - int(a.ticket_count)).slice(0, 10);
		const custCard = `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Macaamiisha ugu badan")}</p>
				<p class="ytmr-sub">${t("By tickets in the period")}</p></div></div>
			${custs.length ? hbars(custs, "customer_name", "ticket_count") : `<div class="ytmr-empty">${t("No data. Use Refresh data.")}</div>`}
		</div>`;

		// Engineer share donut: top 6 + Kale (rest)
		const engs = (d.engineer_rows || []).filter((r) => int(r.ticket_count) > 0);
		const top = engs.slice(0, 6);
		const restCount = engs.slice(6).reduce((s, r) => s + int(r.ticket_count), 0);
		const seg = top.map((r, i) => ({ name: r.engineer_name, n: int(r.ticket_count), c: PALETTE[i % PALETTE.length] }));
		if (restCount) seg.push({ name: t("Kale"), n: restCount, c: PALETTE[6] });
		const sum = seg.reduce((s, x) => s + x.n, 0);
		const R = 54, C = 2 * Math.PI * R, gap = seg.length > 1 ? 3 : 0;
		let off = 0;
		const arcs = seg.map((x) => {
			const len = (x.n / (sum || 1)) * C;
			const a = `<circle r="${R}" cx="66" cy="66" fill="none" stroke="${x.c}" stroke-width="14" stroke-dasharray="${Math.max(0.1, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"><title>${esc(x.name)}: ${x.n}</title></circle>`;
			off += len;
			return a;
		}).join("");
		const legend = seg.map((x) => `<div class="ytmr-legend-row"><span class="ytmr-swatch" style="background:${x.c}"></span><span class="ytmr-lg-name">${esc(x.name)}</span>
			<strong>${x.n}</strong><span class="ytmr-lg-pct">${sum ? Math.round((x.n / sum) * 100) : 0}%</span></div>`).join("");
		const engCard = `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Qeybta injineerada")}</p><p class="ytmr-sub">${t("Share of tickets per engineer")}</p></div></div>
			${sum ? `<div class="ytmr-split"><div class="ytmr-donut"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
				<circle r="${R}" cx="66" cy="66" fill="none" stroke="var(--y-hover)" stroke-width="14"/>${arcs}</svg>
				<div class="ytmr-donut-c"><strong>${sum}</strong><span>${t("tickets")}</span></div></div>
				<div class="ytmr-legend">${legend}</div></div>` : `<div class="ytmr-empty">${t("No data. Use Refresh data.")}</div>`}
		</div>`;
		return `<div class="ytmr-insights">${issueCard}${custCard}${engCard}</div>`;
	}

	function editBox(o) {
		const attrs = `data-key="${esc(o.key)}" data-field="${esc(o.field)}"${o.cdt ? ` data-cdt="${esc(o.cdt)}" data-cdn="${esc(o.cdn)}"` : ""}`;
		const ctl = !o.editable
			? `<div class="ytmr-ro ${o.value ? "" : "is-empty"}">${o.value ? esc(o.value) : esc(o.empty || t("Nothing written yet"))}</div>`
			: o.multiline === false
				? `<input class="ytmr-input" ${attrs} value="${esc(o.value || "")}" placeholder="${esc(o.placeholder || "")}">`
				: `<textarea class="ytmr-input" rows="2" ${attrs} placeholder="${esc(o.placeholder || "")}">${esc(o.value || "")}</textarea>`;
		return o.label ? `<div class="ytmr-field"><span class="ytmr-field-label">${o.label}</span>${ctl}</div>` : ctl;
	}

	function nuxur(frm, d, p) {
		// hordhac is a Text Editor field: show/edit its plain text. Typing writes plain text back to the
		// field (that then counts as an edit, so a refresh keeps it — same rule as the nuxur fields).
		const items = [
			["hordhac", t("HORDHAC"), htmlToText(d.hordhac)],
			["nuxur_cilado", t("Ciladaha"), d.nuxur_cilado || ""],
			["nuxur_macaamiil", t("Macaamiisha"), d.nuxur_macaamiil || ""],
			["nuxur_injineer", t("Injineerada"), d.nuxur_injineer || ""],
			["nuxur_kharash", t("Kharashaadka"), d.nuxur_kharash || ""],
		];
		const boxes = items.map((it) =>
			editBox({ key: it[0], field: it[0], value: it[2], editable: p.editable, label: it[1], placeholder: t("Qor qoraalka halkan...") })).join("");
		return `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Nuxurka warbixinta bishan")}</p>
				<p class="ytmr-sub">${t("Auto-written Somali sentences — edit freely; Refresh data never overwrites your edits")}</p></div>
				<span class="ytmr-icon-tile">${icon("text")}</span></div>
			<div style="display:flex;flex-direction:column;gap:14px">${boxes}</div>
		</div>`;
	}

	function tableCard(frm, key, title, sub, head, rowsHtml, totalHtml, count) {
		const st = state(frm);
		const showAll = !!st.show[key];
		const foot = count > ROWS_PER_PAGE
			? `<span>${t("Showing {0} of {1}", [showAll ? count : ROWS_PER_PAGE, count])}</span>
				<button type="button" class="ytmr-btn ytmr-btn--sm" data-act="showall" data-tkey="${key}">${showAll ? t("Show first {0}", [ROWS_PER_PAGE]) : t("Show all {0}", [count])}</button>`
			: `<span>${t("{0} rows", [count])}</span>`;
		return `<div class="ytmr-card">
			<div class="ytmr-h" style="margin-bottom:16px"><div class="ytmr-h-text"><p class="ytmr-title">${title}</p><p class="ytmr-sub">${sub}</p></div></div>
			<div class="ytmr-table-wrap"><table class="ytmr-table"><thead><tr>${head}</tr></thead><tbody>${rowsHtml || `<tr><td colspan="9"><div class="ytmr-empty">${t("No data. Use Refresh data.")}</div></td></tr>`}${rowsHtml ? totalHtml : ""}</tbody></table></div>
			<div class="ytmr-table-foot">${foot}</div>
		</div>`;
	}

	function tableIssues(frm, d) {
		const rows = d.issue_rows || [];
		const st = state(frm);
		const shown = st.show.issues ? rows : rows.slice(0, ROWS_PER_PAGE);
		const body = shown.map((r, i) => `<tr><td class="ytmr-muted is-num" style="text-align:left">${i + 1}</td>
			<td class="ytmr-main">${esc(r.issue_type)}</td><td class="is-num">${int(r.ticket_count)}</td>
			<td class="is-num">${esc(r.pct || "")}</td><td class="is-num">${money(r.expense)}</td></tr>`).join("");
		const total = `<tr class="is-total"><td></td><td>${t("Wadarta Ciladaha")}</td><td class="is-num">${int(d.total_issues)}</td><td class="is-num">100%</td><td class="is-num">${money(d.total_expense)}</td></tr>`;
		const head = `<th>L</th><th>${t("Nuuca Cilada")}</th><th class="is-num">${t("Tirada")}</th><th class="is-num">${t("Boqolkiiba")}</th><th class="is-num">${t("Kharashaadka")}</th>`;
		return tableCard(frm, "issues", t("Warbixinta Ciladaha"), t("Issue types in the period — 'Lama xirin ticket' holds expenses with no linked ticket"), head, body, total, rows.length);
	}

	function tableCustomers(frm, d) {
		const rows = d.customer_rows || [];
		const st = state(frm);
		const shown = st.show.customers ? rows : rows.slice(0, ROWS_PER_PAGE);
		const body = shown.map((r, i) => `<tr><td class="ytmr-muted is-num" style="text-align:left">${i + 1}</td>
			<td class="ytmr-main">${esc(r.customer_name)}</td><td class="is-num">${int(r.ticket_count)}</td>
			<td class="is-num">${esc(r.ticket_pct || "")}</td><td class="is-num">${money(r.expense)}</td><td class="is-num">${esc(r.expense_pct || "")}</td></tr>`).join("");
		const total = `<tr class="is-total"><td></td><td>${t("Wadarta Guud")}</td><td class="is-num">${int(d.total_issues)}</td><td class="is-num">100.00%</td><td class="is-num">${money(d.total_expense)}</td><td class="is-num">100.00%</td></tr>`;
		const head = `<th>L</th><th>${t("Magaca Macmilka")}</th><th class="is-num">${t("Ciladaha")}</th><th class="is-num">${t("Boqolkiba")}</th><th class="is-num">${t("Qarashka")}</th><th class="is-num">${t("Boqolkiba")}</th>`;
		return tableCard(frm, "customers", t("Macaamiisha shaqooyinka loo qabtay"), t("Alphabetical — avg expense per issue {0}", [money(d.avg_expense_per_issue)]), head, body, total, rows.length);
	}

	function tableEngineers(frm, d) {
		const rows = d.engineer_rows || [];
		const st = state(frm);
		const shown = st.show.engineers ? rows : rows.slice(0, ROWS_PER_PAGE);
		const body = shown.map((r, i) => `<tr><td class="ytmr-muted is-num" style="text-align:left">${i + 1}</td>
			<td class="ytmr-main">${esc(r.engineer_name)}</td><td class="is-num">${int(r.ticket_count)}</td>
			<td class="is-num">${int(r.overtime_count)}</td><td class="is-num">${int(r.online_count)}</td><td class="is-num">${esc(r.pct || "")}</td></tr>`).join("");
		const sumOv = rows.reduce((s, r) => s + int(r.overtime_count), 0);
		const sumOn = rows.reduce((s, r) => s + int(r.online_count), 0);
		const total = `<tr class="is-total"><td></td><td>${t("Wadarta")}</td><td class="is-num">${int(d.total_issues)}</td><td class="is-num">${sumOv}</td><td class="is-num">${sumOn}</td><td class="is-num">100%</td></tr>`;
		const head = `<th>L</th><th>${t("Magaca")}</th><th class="is-num">${t("Ciladaha guud")}</th><th class="is-num">${t("Overtime")}</th><th class="is-num">${t("Online")}</th><th class="is-num">${t("Boqolkiiba")}</th>`;
		return tableCard(frm, "engineers", t("Waxqabadka Injineerada Farsamada"), t("Every active agent, incl. zeros — the counts add up to the total"), head, body, total, rows.length);
	}

	function challenges(frm, d, p) {
		const rows = d.challenges || [];
		const cards = rows.map((r, i) => `<div class="ytmr-item">
			<div class="ytmr-item-head"><span class="ytmr-num">#${i + 1}</span>
				${r.suggested ? `<span class="ytmr-badge ytmr-badge--warn">${icon("star", 14, 2)}${t("Suggested")}</span>` : ""}
				${r.engineer_name ? `<span class="ytmr-badge">${esc(r.engineer_name)}</span>` : ""}
				${r.source_emr ? `<a class="ytmr-tlink" href="/app/engineer-monthly-report/${encodeURIComponent(r.source_emr)}" target="_blank" rel="noopener">${esc(r.source_emr)}</a>` : ""}
				<span class="ytmr-grow"></span>
				${p.editable ? `<button type="button" class="ytmr-btn ytmr-btn--ghost ytmr-btn--icon ytmr-btn--danger" data-act="del" data-cdt="${esc(r.doctype)}" data-cdn="${esc(r.name)}" data-table="challenges" aria-label="${t("Delete")}" title="${t("Delete")}">${icon("trash", 18)}</button>` : ""}
			</div>
			${editBox({ key: r.name + ":challenge", field: "challenge", cdt: r.doctype, cdn: r.name, value: r.challenge, editable: p.editable, label: t("Caqabada"), placeholder: t("What was difficult?") })}
			${editBox({ key: r.name + ":solution", field: "solution", cdt: r.doctype, cdn: r.name, value: r.solution, editable: p.editable, label: t("Xalka"), placeholder: t("How was it solved?") })}
		</div>`).join("");
		return `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Caqabadaha iyo Xalka")}</p><p class="ytmr-sub">${t("Pre-filled from the engineers' monthly reports — deleted suggestions stay away after Refresh")}</p></div>
				${p.editable ? `<button type="button" class="ytmr-btn" data-act="add" data-table="challenges">${icon("plus", 18)}${t("Add")}</button>` : ""}</div>
			${rows.length ? `<div class="ytmr-grid2">${cards}</div>` : `<div class="ytmr-empty">${t("No challenges recorded.")}</div>`}
		</div>`;
	}

	function stars(rating) {
		const v = num(rating);
		if (!v) return "";
		const n = Math.round(v <= 1 ? v * 5 : v);
		let s = "";
		for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? "" : "is-off"}">${icon("star", 16, 0).replace('fill="none"', 'fill="currentColor"')}</span>`;
		return `<span class="ytmr-stars" title="${n}/5">${s}</span>`;
	}
	function feedback(d, p) {
		const rows = d.feedback_rows || [];
		const cards = rows.map((r) => `<div class="ytmr-item">
			<div class="ytmr-item-head">
				${p.editable && !r.client_name ? `<div style="flex:1;min-width:0">${editBox({ key: r.name + ":client_name", field: "client_name", cdt: r.doctype, cdn: r.name, value: r.client_name, editable: true, multiline: false, placeholder: t("Client name") })}</div>`
					: `<span style="font:600 16px/24px var(--y-font);color:var(--y-t900)">${esc(r.client_name || t("Client"))}</span>`}
				${stars(r.rating)}
				${r.source ? `<span class="ytmr-badge">${esc(r.source)}</span>` : ""}
				<span class="ytmr-grow"></span>
				${p.editable ? `<button type="button" class="ytmr-btn ytmr-btn--ghost ytmr-btn--icon ytmr-btn--danger" data-act="del" data-cdt="${esc(r.doctype)}" data-cdn="${esc(r.name)}" data-table="feedback_rows" aria-label="${t("Delete")}" title="${t("Delete")}">${icon("trash", 18)}</button>` : ""}
			</div>
			${editBox({ key: r.name + ":feedback", field: "feedback", cdt: r.doctype, cdn: r.name, value: r.feedback, editable: p.editable, placeholder: t("What did the client say?") })}
		</div>`).join("");
		return `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Falcelinta Macaamiisha")}</p><p class="ytmr-sub">${t("From engineer reports and ticket feedback")}</p></div>
				${p.editable ? `<button type="button" class="ytmr-btn" data-act="add" data-table="feedback_rows">${icon("plus", 18)}${t("Add")}</button>` : ""}</div>
			${rows.length ? `<div class="ytmr-grid2">${cards}</div>` : `<div class="ytmr-empty">${t("No client feedback recorded.")}</div>`}
		</div>`;
	}

	function emrLinks(d) {
		const rows = d.emr_links || [];
		const chips = rows.map((r) => `<a class="ytmr-tlink" href="/app/engineer-monthly-report/${encodeURIComponent(r.emr)}" target="_blank" rel="noopener">
			${esc(r.engineer_name || r.emr)} · ${esc(r.emr)}${r.emr_status ? ` · ${esc(t(r.emr_status))}` : ""}</a>`).join("");
		return `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Engineer Monthly Reports")}</p><p class="ytmr-sub">${t("The engineers' own reports for this period")}</p></div><span class="ytmr-icon-tile">${icon("doc")}</span></div>
			${rows.length ? `<div class="ytmr-chips">${chips}</div>` : `<div class="ytmr-empty">${t("No Engineer Monthly Reports found for this period.")}</div>`}
		</div>`;
	}

	function approval(frm, d, p) {
		let note = "", actions = "";
		if (p.status === "Draft") {
			note = `${statusPill("Draft")}<span>${t("When the report is complete, submit it for approval.")}</span>`;
			if (p.canSubmit) actions = `<button type="button" class="ytmr-btn ytmr-btn--primary" data-act="submit">${icon("send", 18)}${t("Submit for approval")}</button>`;
		} else if (p.status === "Submitted") {
			note = `${statusPill("Submitted")}<span>${t("Review the report and approve — approving locks it and stamps your name.")}</span>`;
			if (p.canApprove) actions = `<button type="button" class="ytmr-btn" data-act="draft">${icon("undo", 18)}${t("Send back to Draft")}</button>
				<button type="button" class="ytmr-btn ytmr-btn--primary" data-act="approve">${icon("check", 18)}${t("Approve")}</button>`;
		} else {
			note = `${statusPill("Approved")}<span>${t("Approved by {0} — this report is locked.", [esc(d.approved_by_name || d.approved_by || "")])}</span>`;
		}
		return `<div class="ytmr-card">
			<div class="ytmr-h"><div class="ytmr-h-text"><p class="ytmr-title">${t("Meelmarinta warbixinta")}</p></div></div>
			<div class="ytmr-grid2">
				<div class="ytmr-item"><div class="ytmr-item-head"><span class="ytmr-eyebrow">${t("Diyaariyay")}</span></div>
					<div class="ytmr-ro">${esc(d.prepared_by_name || d.prepared_by || "")}</div><div class="ytmr-ro ytmr-muted" style="font-size:13px">${esc(d.prepared_by || "")}</div></div>
				<div class="ytmr-item"><div class="ytmr-item-head"><span class="ytmr-eyebrow">${t("Ansixiyay")}</span></div>
					<div class="ytmr-ro ${d.approved_by_name ? "" : "is-empty"}">${esc(d.approved_by_name || t("Not approved yet"))}</div><div class="ytmr-ro ytmr-muted" style="font-size:13px">${esc(d.approved_by || "")}</div></div>
			</div>
			<div class="ytmr-approval"><div class="ytmr-approval-note">${note}</div><div class="ytmr-approval-actions">${actions}</div></div>
		</div>`;
	}

	// ---------- events (delegated, bound once per wrapper) ----------
	function bind(host) {
		if (host.__ytmr_bound) return;
		host.__ytmr_bound = true;
		const frmOf = () => host.__ytmr_frm;
		host.addEventListener("click", (e) => {
			const frm = frmOf();
			const b = e.target.closest("[data-act]");
			if (!b || b.disabled) return;
			const act = b.dataset.act, menu = host.querySelector(".ytmr-menu");
			if (act === "menu") { menu && menu.classList.toggle("is-open"); return; }
			if (menu) menu.classList.remove("is-open");
			if (act === "showall") { const st = state(frm); st.show[b.dataset.tkey] = !st.show[b.dataset.tkey]; render(frm); return; }
			if (act === "raw") return toggleRaw(frm, true);
			if (act === "add") return addRow(frm, b.dataset.table);
			if (act === "del") return deleteRow(frm, b.dataset.cdt, b.dataset.cdn, b.dataset.table);
			if (act === "save") { flushAll(frm); return frm.save(); }
			if (ACTIONS[act]) return runAction(frm, act);
		});
		host.addEventListener("input", (e) => {
			const frm = frmOf(), el = e.target;
			if (el.dataset && el.dataset.field) { el.dataset.dirty = "1"; autoGrow(el); updateSaveState(frm); }
		});
		host.addEventListener("focusout", (e) => {
			const frm = frmOf(), el = e.target;
			if (el.dataset && el.dataset.field && el.dataset.dirty) { flushEl(frm, el); scheduleSave(frm); updateSaveState(frm); }
		});
		host.addEventListener("keydown", (e) => {
			if (e.key === "Escape") { const m = host.querySelector(".ytmr-menu.is-open"); if (m) m.classList.remove("is-open"); }
		});
	}
	if (!window.__ytmr_doc_click) {
		window.__ytmr_doc_click = true;
		document.addEventListener("click", (e) => {
			document.querySelectorAll(".ytmr .ytmr-menu.is-open").forEach((m) => { if (!m.parentElement.contains(e.target)) m.classList.remove("is-open"); });
		});
	}

	function injectStyle() {
		if (!document.getElementById(STYLE_ID)) {
			const s = document.createElement("style");
			s.id = STYLE_ID;
			s.textContent = CSS;
			document.head.appendChild(s);
		}
		if (!document.getElementById("ytmr-font") && !document.querySelector('link[href*="family=Manrope"]')) {
			const l = document.createElement("link");
			l.id = "ytmr-font";
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
				setTimeout(() => hideToolbarDuplicates(frm), 0);
				toggleRaw(frm, !!state(frm).rawOpen, false);
			} else {
				toggleRaw(frm, true, false);
			}
		},
		validate(frm) { flushAll(frm); },
		after_save(frm) { updateSaveState(frm); },
	});
})();
