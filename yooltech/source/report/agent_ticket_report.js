// Wrapped in an IIFE: Frappe evaluates report scripts in the global scope.
(() => {
// Figma design system "UI-dinsg" (kkmiC7lB8fcrjDcpTrW160): tokens from the Chart, Dropdowns and
// table/number components, scoped to this report's route so no other Desk page changes.
const ATR_STYLE_ID = "yool-atr-figma";
const ATR_SCOPE = 'body[data-route="query-report/Agent Ticket Report"]';
const ATR_CSS = `
${ATR_SCOPE} {
	--atr-brand: #1db487; /* bg-brand-bold (600) */
	--atr-focus-border: #6ee8c3; /* functional-teal-green (300) */
	--atr-open-border: #20c997; /* border-brand-primary (500) */
	--atr-brand-soft-bg: #e9fbf6; /* bg-brand-primary (50) */
	--atr-brand-soft-text: #1aa37a; /* text-brand-secondary (700) */
	--atr-text-900: #070a0e; /* text-gray-primary (900) */
	--atr-text-500: #4a4c4f; /* text-gray-secondary (500) */
	--atr-text-300: #8f9193; /* text-gray-tertiary (300) */
	--atr-bg-white: #ffffff; /* bg-white-primary (F-900) */
	--atr-bg-25: #fafafa; /* bg-gray-tertiary (25) */
	--atr-bg-50: #f0f0f1; /* bg-gray-secondary-hover (50) */
	--atr-border-100: #dadadb; /* border-gray-secondary (100) */
	--atr-border-50: #f0f0f1; /* border-gray-tertiary (50) */
	--atr-font: "Manrope", var(--font-stack, system-ui), sans-serif;
}
${ATR_SCOPE} .page-body { background: var(--atr-bg-50); }
${ATR_SCOPE} .layout-main-section,
${ATR_SCOPE} .layout-main-section * { font-family: var(--atr-font); }
${ATR_SCOPE} .navbar-breadcrumbs li:last-child a { font: 500 20px/28px var(--atr-font); color: var(--atr-text-900); }

/* Cards: white on grey, 24px padding (Chart card) */
${ATR_SCOPE} .report-summary,
${ATR_SCOPE} .chart-wrapper,
${ATR_SCOPE} .report-wrapper {
	background: var(--atr-bg-white) !important;
	border: 0 !important;
	border-radius: 0 !important;
	box-shadow: none !important;
	margin: 0 0 16px !important;
}
${ATR_SCOPE} .chart-wrapper { padding: 24px !important; }

/* Frappe's own filter row stays registered (it drives the query) but is replaced by .atr-bar below. */
${ATR_SCOPE} .page-form { display: none !important; }

/* Filter bar — same layout as the Kanban header: groups (Who / When / What), labels above inputs */
${ATR_SCOPE} .atr-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 16px 0;
	padding: 12px 4px 16px;
	margin: 0 0 16px;
	background: var(--atr-bg-25);
	border-bottom: 1px solid var(--atr-border-50);
}
${ATR_SCOPE} .atr-group { display: flex; flex-direction: column; gap: 8px; padding: 0 20px; border-left: 1px solid var(--atr-border-50); }
${ATR_SCOPE} .atr-group:first-child { border-left: 0; }
${ATR_SCOPE} .atr-group-title { font: 600 12px/18px var(--atr-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--atr-text-300); }
${ATR_SCOPE} .atr-group-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
${ATR_SCOPE} .atr-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; }
${ATR_SCOPE} .atr-field-label { font: 500 14px/20px var(--atr-font); color: var(--atr-text-900); white-space: nowrap; }
${ATR_SCOPE} .atr-arrow { height: 40px; display: flex; align-items: center; color: var(--atr-text-300); }

/* Input dropdown (Figma "Input dropdown": Default / Hover / Open) */
${ATR_SCOPE} .atr-trigger,
${ATR_SCOPE} .atr-input {
	height: 40px;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: var(--atr-bg-white);
	border: 1px solid var(--atr-border-100);
	border-radius: 8px;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
	text-align: left;
	cursor: pointer;
	outline: none;
	box-shadow: none;
}
${ATR_SCOPE} .atr-trigger:hover,
${ATR_SCOPE} .atr-input:hover { border-color: var(--atr-text-300); }
${ATR_SCOPE} .atr-trigger.is-open,
${ATR_SCOPE} .atr-input.is-open { border-color: var(--atr-open-border); }
${ATR_SCOPE} .atr-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${ATR_SCOPE} .atr-trigger.is-empty .atr-trigger-label { color: var(--atr-text-300); }
${ATR_SCOPE} .atr-icon { display: flex; flex: 0 0 auto; color: var(--atr-text-300); transition: transform 150ms; }
${ATR_SCOPE} .atr-trigger.is-open .atr-icon--chevron { transform: rotate(180deg); }
${ATR_SCOPE} .atr-input { cursor: text; }
${ATR_SCOPE} .atr-input input { flex: 1; min-width: 0; border: 0; outline: none; background: none; padding: 0; font: inherit; color: inherit; }
${ATR_SCOPE} .atr-input input::placeholder { color: var(--atr-text-300); }
${ATR_SCOPE} .atr-clear { display: flex; border: 0; background: none; padding: 0; cursor: pointer; color: var(--atr-text-300); }
${ATR_SCOPE} .atr-clear:hover { color: var(--atr-text-900); }

/* Dropdown menu list item (Figma: panel 8px radius, list rows 16px, hover bg-gray-secondary-hover) */
${ATR_SCOPE} .atr-pop {
	position: fixed;
	z-index: 1050;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 8px;
	max-height: 360px;
	overflow-y: auto;
	background: var(--atr-bg-white);
	border: 1px solid var(--atr-border-50);
	border-radius: 8px;
	box-shadow: 0 8px 32px -2px rgba(16, 24, 32, 0.08);
	font-family: var(--atr-font);
}
${ATR_SCOPE} .atr-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border-radius: 8px;
	cursor: pointer;
	white-space: nowrap;
	font: 400 16px/24px var(--atr-font);
	color: var(--atr-text-500);
}
${ATR_SCOPE} .atr-item:hover,
${ATR_SCOPE} .atr-item.is-active { background: var(--atr-bg-50); color: var(--atr-text-900); }
${ATR_SCOPE} .atr-item.is-selected { font-weight: 500; color: var(--atr-text-900); }
${ATR_SCOPE} .atr-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
${ATR_SCOPE} .atr-item-sub { font: 400 14px/20px var(--atr-font); color: var(--atr-text-300); }
${ATR_SCOPE} .atr-item-check { display: flex; color: var(--atr-text-900); }
${ATR_SCOPE} .atr-item-empty { padding: 8px 12px; font: 400 14px/20px var(--atr-font); color: var(--atr-text-300); }
${ATR_SCOPE} .atr-avatar {
	width: 24px;
	height: 24px;
	flex: 0 0 auto;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font: 600 10px/1 var(--atr-font);
	background: var(--atr-brand-soft-bg);
	color: var(--atr-brand-soft-text);
}
${ATR_SCOPE} .atr-lead { width: 24px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }

/* Calendar — Figma has no date picker; built from the dropdown panel, list-item and brand tokens */
${ATR_SCOPE} .atr-pop--cal { padding: 12px; max-height: none; }
${ATR_SCOPE} .atr-cal-head { display: flex; align-items: center; gap: 4px; padding-bottom: 4px; }
${ATR_SCOPE} .atr-cal-title { flex: 1; text-align: center; font: 600 16px/24px var(--atr-font); color: var(--atr-text-900); }
${ATR_SCOPE} .atr-cal-nav {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border: 0;
	border-radius: 8px;
	background: none;
	cursor: pointer;
	color: var(--atr-text-500);
}
${ATR_SCOPE} .atr-cal-nav:hover { background: var(--atr-bg-50); }
${ATR_SCOPE} .atr-cal-grid { display: grid; grid-template-columns: repeat(7, 36px); gap: 2px; }
${ATR_SCOPE} .atr-cal-dow { height: 32px; display: flex; align-items: center; justify-content: center; font: 500 12px/18px var(--atr-font); color: var(--atr-text-300); }
${ATR_SCOPE} .atr-cal-day {
	position: relative;
	height: 36px;
	border: 0;
	border-radius: 8px;
	padding: 0;
	background: none;
	cursor: pointer;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
}
${ATR_SCOPE} .atr-cal-day:hover { background: var(--atr-bg-50); }
${ATR_SCOPE} .atr-cal-day.is-outside { color: var(--atr-text-300); }
${ATR_SCOPE} .atr-cal-day.is-today { color: var(--atr-brand-soft-text); }
${ATR_SCOPE} .atr-cal-day.is-today::after {
	content: "";
	position: absolute;
	left: 50%;
	bottom: 5px;
	width: 4px;
	height: 4px;
	margin-left: -2px;
	border-radius: 50%;
	background: var(--atr-brand);
}
${ATR_SCOPE} .atr-cal-day.is-range { background: var(--atr-brand-soft-bg); }
${ATR_SCOPE} .atr-cal-day.is-selected { background: var(--atr-brand); color: #ffffff; font-weight: 600; }
${ATR_SCOPE} .atr-cal-day.is-selected::after { display: none; }
${ATR_SCOPE} .atr-cal-day:disabled { opacity: 0.35; cursor: default; background: none; }
${ATR_SCOPE} .atr-cal-foot {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 6px;
	padding-top: 8px;
	border-top: 1px solid var(--atr-border-50);
}
${ATR_SCOPE} .atr-cal-btn {
	border: 0;
	background: none;
	border-radius: 8px;
	padding: 6px 10px;
	cursor: pointer;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-500);
}
${ATR_SCOPE} .atr-cal-btn:hover { background: var(--atr-bg-50); }
${ATR_SCOPE} .atr-cal-btn--brand { color: var(--atr-brand-soft-text); }

/* Summary = Number + badge (label H8 Medium, value H4 SemiBold, first tile bg-gray-tertiary) */
${ATR_SCOPE} .report-summary {
	display: flex !important;
	flex-wrap: wrap;
	gap: 16px;
	justify-content: flex-start !important;
	height: auto !important;
	padding: 24px !important;
}
${ATR_SCOPE} .report-summary .summary-separator { display: none !important; }
${ATR_SCOPE} .report-summary .summary-item {
	flex: 1 1 150px;
	min-width: 140px;
	margin: 0 !important;
	padding: 18px;
	border-radius: 4px;
	height: auto !important;
	min-height: 0 !important;
	display: flex !important;
	flex-direction: column !important;
	gap: 2px;
	align-items: flex-start !important;
	justify-content: flex-start !important;
	text-align: left !important;
}
${ATR_SCOPE} .report-summary .summary-item:first-child { background: var(--atr-bg-25); }
${ATR_SCOPE} .report-summary .summary-label {
	height: auto !important;
	font: 500 16px/24px var(--atr-font);
	color: var(--atr-text-500);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 100%;
}
${ATR_SCOPE} .report-summary .summary-value {
	height: auto !important;
	overflow: visible !important;
	font: 600 32px/44px var(--atr-font);
	color: var(--atr-text-900) !important;
}

/* Chart: title H6, axis labels H9 tertiary, grid border-gray-tertiary */
${ATR_SCOPE} .chart-wrapper .frappe-chart .title { font: 500 20px/28px var(--atr-font); fill: var(--atr-text-900); }
${ATR_SCOPE} .chart-wrapper .frappe-chart text { font-family: var(--atr-font); fill: var(--atr-text-300); }
${ATR_SCOPE} .chart-wrapper .frappe-chart .x.axis text { fill: var(--atr-text-900); }
${ATR_SCOPE} .chart-wrapper .frappe-chart line { stroke: var(--atr-border-50); }
${ATR_SCOPE} .chart-wrapper .chart-legend text { fill: var(--atr-text-500); }

/* Table (Figma "Table"): white card, 1px border-gray-tertiary, 12px radius; header cells bg-gray-tertiary,
   H9 Medium text-gray-primary; body rows divided by border-gray-tertiary; status as Pill with dot. */
${ATR_SCOPE} .report-wrapper {
	padding: 0 !important;
	margin: 0 24px 24px !important;
	border: 1px solid var(--atr-border-50) !important;
	border-radius: 12px !important;
	overflow: hidden;
}
${ATR_SCOPE} .report-wrapper .datatable { border: 0; }
${ATR_SCOPE} .report-wrapper .dt-scrollable { border-top: 0; }
${ATR_SCOPE} .report-wrapper .dt-cell {
	background: var(--atr-bg-white);
	border-top: 0 !important;
	border-left: 0 !important;
	border-right: 0 !important;
	border-bottom: 1px solid var(--atr-border-50) !important;
}
${ATR_SCOPE} .report-wrapper .dt-cell__content {
	display: flex;
	align-items: center;
	padding: 0 16px;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
}
${ATR_SCOPE} .report-wrapper .dt-row:not(.dt-row-header):not(.dt-row-filter) .dt-cell__content { height: 100%; }
${ATR_SCOPE} .report-wrapper .dt-header .dt-row,
${ATR_SCOPE} .report-wrapper .dt-header .dt-cell { height: 48px !important; }
${ATR_SCOPE} .report-wrapper .dt-cell--header { background: var(--atr-bg-25); }
${ATR_SCOPE} .report-wrapper .dt-cell--header .dt-cell__content {
	height: 48px;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
}
${ATR_SCOPE} .report-wrapper .dt-cell--col-0 .dt-cell__content { justify-content: center; padding: 0 8px; color: var(--atr-text-300); font-weight: 400; }
${ATR_SCOPE} .report-wrapper .dt-row-filter .dt-cell { background: var(--atr-bg-white); }
${ATR_SCOPE} .report-wrapper .dt-row-filter .dt-cell__content { height: 48px; padding: 0 8px; align-items: center; }
/* Column search: compact Figma text input with a search icon (the serial column's disabled box is hidden). */
${ATR_SCOPE} .report-wrapper .dt-filter {
	width: 100%;
	height: 32px !important;
	min-height: 0 !important;
	align-self: center;
	box-sizing: border-box;
	padding: 6px 10px 6px 32px !important;
	border: 1px solid var(--atr-border-100) !important;
	border-radius: 8px;
	background: var(--atr-bg-white) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238f9193' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 10px center !important;
	font: 500 13px/18px var(--atr-font);
	color: var(--atr-text-900);
	box-shadow: none;
}
${ATR_SCOPE} .report-wrapper .dt-filter::placeholder { color: var(--atr-text-300); font-weight: 400; }
${ATR_SCOPE} .report-wrapper .dt-filter:hover { border-color: var(--atr-text-300) !important; }
${ATR_SCOPE} .report-wrapper .dt-filter:disabled { display: none; }
${ATR_SCOPE} .report-wrapper .dt-filter:focus { border-color: var(--atr-focus-border) !important; box-shadow: 0 0 0 4px rgba(29, 180, 135, 0.2); outline: none; }
${ATR_SCOPE} .report-wrapper .dt-row:hover .dt-cell { background: var(--atr-bg-25); }
${ATR_SCOPE} .report-wrapper .dt-cell--highlight,
${ATR_SCOPE} .report-wrapper .dt-cell--focus { background: var(--atr-bg-25); }
${ATR_SCOPE} .report-wrapper .dt-cell .dt-dropdown__toggle { color: var(--atr-text-300); }
${ATR_SCOPE} .report-wrapper a.atr-link {
	color: var(--atr-text-900);
	font-weight: 600;
	text-decoration: underline;
	text-decoration-color: var(--atr-brand);
	text-underline-offset: 3px;
}
${ATR_SCOPE} .report-wrapper .atr-muted { color: var(--atr-text-300); font-weight: 400; }
${ATR_SCOPE} .report-wrapper .atr-secondary { color: var(--atr-text-500); font-weight: 400; }

/* Pill with dot (Figma "Pill": white, border-gray-secondary, 120px radius, 8px dot) */
${ATR_SCOPE} .atr-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0 10px;
	border: 1px solid var(--atr-border-100);
	border-radius: 120px;
	background: var(--atr-bg-white);
	font: 500 14px/22px var(--atr-font);
	color: var(--atr-text-900);
	white-space: nowrap;
}
${ATR_SCOPE} .atr-pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--atr-dot, var(--atr-text-300)); }
${ATR_SCOPE} .atr-pill--green { --atr-dot: var(--atr-brand); }
${ATR_SCOPE} .atr-pill--orange { --atr-dot: #f38744; }
${ATR_SCOPE} .atr-pill--red { --atr-dot: #be2f33; }
${ATR_SCOPE} .atr-pill--gray { --atr-dot: var(--atr-text-300); }

/* Bajaaj expense by company — same Figma table card as the report table */
${ATR_SCOPE} .form-message:has(.atr-baj-data) { display: none !important; }
${ATR_SCOPE} .atr-baj {
	margin: 0 24px 16px;
	background: var(--atr-bg-white);
	border: 1px solid var(--atr-border-50);
	border-radius: 12px;
	overflow: hidden;
}
${ATR_SCOPE} .atr-baj-head { display: flex; align-items: baseline; gap: 12px; padding: 20px 24px 16px; }
${ATR_SCOPE} .atr-baj-title { font: 500 20px/28px var(--atr-font); color: var(--atr-text-900); }
${ATR_SCOPE} .atr-baj-sub { font: 400 14px/20px var(--atr-font); color: var(--atr-text-500); }
${ATR_SCOPE} .atr-baj table { width: 100%; border-collapse: collapse; }
${ATR_SCOPE} .atr-baj th {
	height: 48px;
	padding: 0 24px;
	background: var(--atr-bg-25);
	border-top: 1px solid var(--atr-border-50);
	border-bottom: 1px solid var(--atr-border-50);
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
	text-align: left;
	white-space: nowrap;
}
${ATR_SCOPE} .atr-baj td {
	height: 56px;
	padding: 0 24px;
	border-bottom: 1px solid var(--atr-border-50);
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
	white-space: nowrap;
}
${ATR_SCOPE} .atr-baj .is-num { text-align: right; }
${ATR_SCOPE} .atr-baj tbody tr { cursor: pointer; }
${ATR_SCOPE} .atr-baj tbody tr:hover td { background: var(--atr-bg-25); }
${ATR_SCOPE} .atr-baj tbody tr.is-active td { background: var(--atr-brand-soft-bg); }
${ATR_SCOPE} .atr-baj .atr-baj-id { display: block; font: 400 12px/18px var(--atr-font); color: var(--atr-text-500); }
${ATR_SCOPE} .atr-baj-empty { padding: 16px 24px 20px; font: 400 14px/20px var(--atr-font); color: var(--atr-text-500); }
${ATR_SCOPE} .atr-baj-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 14px 24px;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-500);
}
${ATR_SCOPE} .atr-baj-foot button {
	border: 1px solid var(--atr-border-100);
	background: var(--atr-bg-white);
	border-radius: 8px;
	padding: 6px 12px;
	font: 500 14px/20px var(--atr-font);
	color: var(--atr-text-900);
	cursor: pointer;
}
${ATR_SCOPE} .atr-baj-foot button:hover { background: var(--atr-bg-25); }
${ATR_SCOPE} .atr-baj-unlinked { color: #942528; }
${ATR_SCOPE} .atr-baj-unlinked a { color: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; margin-left: 8px; }
${ATR_SCOPE} .report-wrapper .atr-total { font-weight: 700; }
/* Two-line ticket cells (Figma table cell: H9 Medium main line + H10 Regular secondary line) */
${ATR_SCOPE} .report-wrapper .atr-two { display: flex; flex-direction: column; justify-content: center; gap: 2px; width: 100%; min-width: 0; text-align: left; }
${ATR_SCOPE} .report-wrapper .atr-two__main,
${ATR_SCOPE} .report-wrapper .atr-two__sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${ATR_SCOPE} .report-wrapper .atr-two__main { font: 500 14px/20px var(--atr-font); color: var(--atr-text-900); }
${ATR_SCOPE} .report-wrapper .atr-two__sub { font: 400 12px/16px var(--atr-font); color: var(--atr-text-500); }
${ATR_SCOPE} .report-wrapper .atr-two__sub .atr-dot { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; vertical-align: 1px; background: var(--atr-dot, var(--atr-text-300)); }
${ATR_SCOPE} .report-wrapper .atr-two .atr-pill { line-height: 18px; font-size: 13px; }
/* The "Bajaaj Expense" KPI card opens / closes the section */
${ATR_SCOPE} .report-summary .summary-item.atr-baj-card { cursor: pointer; border: 1px solid transparent; transition: background 150ms, border-color 150ms; }
${ATR_SCOPE} .report-summary .summary-item.atr-baj-card:hover { background: var(--atr-bg-25); border-color: var(--atr-border-50); }
${ATR_SCOPE} .report-summary .summary-item.atr-baj-card.is-open { background: var(--atr-brand-soft-bg); border-color: var(--atr-brand); }
${ATR_SCOPE} .report-summary .atr-baj-card .summary-label::after {
	content: "";
	display: inline-block;
	width: 7px;
	height: 7px;
	margin: 0 0 3px 8px;
	border-right: 2px solid var(--atr-text-300);
	border-bottom: 2px solid var(--atr-text-300);
	transform: rotate(45deg);
	transition: transform 150ms;
}
${ATR_SCOPE} .report-summary .atr-baj-card.is-open .summary-label::after { transform: rotate(225deg); margin-bottom: -1px; border-color: var(--atr-brand); }

/* Page actions: secondary button following the input border/radius tokens */
${ATR_SCOPE} .page-head .page-actions .btn {
	height: 40px;
	padding: 8px 14px;
	border-radius: 8px;
	border: 1px solid var(--atr-border-100);
	background: var(--atr-bg-white);
	color: var(--atr-text-900);
	font: 600 14px/20px var(--atr-font);
	box-shadow: none;
}
${ATR_SCOPE} .page-head .page-actions .btn:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const injectFigmaStyles = () => {
	if (document.getElementById(ATR_STYLE_ID)) return;
	// Manrope (Figma typography) supports the Latin alphabet used for Somali.
	const font = document.createElement("link");
	font.rel = "stylesheet";
	font.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap";
	document.head.appendChild(font);
	const style = document.createElement("style");
	style.id = ATR_STYLE_ID;
	style.textContent = ATR_CSS;
	document.head.appendChild(style);
};

// ---------- Filter bar: Figma "Input dropdown" + "Dropdown menu list item" instead of native selects/datepicker ----------
const SVG = {
	chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
	calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
	search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
	close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
	check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
	left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
	right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
};
const h = (tag, cls, text) => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text != null) e.textContent = text;
	return e;
};
const icon = (svg, extra) => {
	const i = h("span", "atr-icon" + (extra ? " " + extra : ""));
	i.innerHTML = svg;
	return i;
};
const initialsOf = (name) =>
	(name || "?")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w.charAt(0).toUpperCase())
		.join("");

// One popup open at a time, attached to <body> so the report's overflow never clips it.
let openPop = null;
const closePop = () => {
	if (!openPop) return;
	const done = openPop.panel.atrOnClose;
	openPop.panel.remove();
	openPop.anchor.classList.remove("is-open");
	openPop = null;
	if (done) done();
};
const openPopover = (anchor, panel) => {
	closePop();
	const r = anchor.getBoundingClientRect();
	panel.style.minWidth = r.width + "px";
	document.body.append(panel);
	panel.style.left = r.left + "px";
	panel.style.top = r.bottom + 8 + "px";
	const pr = panel.getBoundingClientRect();
	if (pr.right > innerWidth - 8) panel.style.left = Math.max(8, innerWidth - 8 - pr.width) + "px";
	if (pr.bottom > innerHeight - 8) panel.style.top = Math.max(8, r.top - 8 - pr.height) + "px";
	anchor.classList.add("is-open");
	openPop = { anchor, panel };
};
document.addEventListener(
	"mousedown",
	(e) => {
		if (openPop && !openPop.panel.contains(e.target) && !openPop.anchor.contains(e.target)) closePop();
	},
	true
);
document.addEventListener("keydown", (e) => e.key === "Escape" && closePop());
window.addEventListener("resize", closePop);
// Page/table scroll moves the anchor, so close; scrolling inside the list itself must not.
window.addEventListener("scroll", (e) => openPop && !openPop.panel.contains(e.target) && closePop(), true);

const menuItem = (lead, label, sub, selected) => {
	const row = h("div", "atr-item" + (selected ? " is-selected" : ""));
	if (lead) row.append(lead);
	row.append(h("span", "atr-item-label", label));
	if (sub) row.append(h("span", "atr-item-sub", sub));
	if (selected) row.append(icon(SVG.check, "atr-item-check"));
	return row;
};

// Select: items [{ value, label, lead?: () => Element }]; onPick(value) is called on change.
const dropdown = (allLabel, onPick) => {
	const b = h("button", "atr-trigger");
	b.type = "button";
	const lab = h("span", "atr-trigger-label");
	b.append(lab, icon(SVG.chevron, "atr-icon--chevron"));
	let items = [];
	let value = "";
	const paint = () => {
		const it = items.find((i) => i.value === value);
		lab.textContent = it ? it.label : allLabel || "";
		b.classList.toggle("is-empty", !it || !it.value);
	};
	b.setOptions = (list) => {
		items = list;
		paint();
	};
	b.setValue = (v) => {
		value = v || "";
		paint();
	};
	b.addEventListener("click", () => {
		if (openPop && openPop.anchor === b) return closePop();
		const panel = h("div", "atr-pop");
		const all = allLabel ? [{ value: "", label: allLabel }] : [];
		const withLead = items.some((i) => i.lead);
		all.concat(items).forEach((it) => {
			const lead = it.lead ? it.lead() : withLead ? h("span", "atr-lead") : null;
			const row = menuItem(lead, it.label, null, it.value === value);
			row.addEventListener("click", () => {
				closePop();
				if (it.value === value) return;
				b.setValue(it.value);
				onPick(it.value);
			});
			panel.append(row);
		});
		openPopover(b, panel);
	});
	paint();
	return b;
};

// Multi-select (Agent): toggle any number of items; empty selection = allLabel (everyone).
// The closed control shows the one chosen agent, or "N agents". Changes apply when the
// list closes (outside click / Escape / trigger), so picking several runs the report once.
const multiDropdown = (allLabel, onPick) => {
	const b = h("button", "atr-trigger");
	b.type = "button";
	const lab = h("span", "atr-trigger-label");
	b.append(lab, icon(SVG.chevron, "atr-icon--chevron"));
	let items = [];
	let values = [];
	const paint = () => {
		if (values.length === 1) {
			const it = items.find((i) => i.value === values[0]);
			lab.textContent = it ? it.label : values[0];
		} else lab.textContent = values.length ? __("{0} agents", [values.length]) : allLabel;
		b.classList.toggle("is-empty", !values.length);
	};
	b.setOptions = (list) => {
		items = list;
		paint();
	};
	b.setValue = (v) => {
		values = (Array.isArray(v) ? v : String(v || "").split(","))
			.map((s) => String(s).trim())
			.filter(Boolean);
		paint();
	};
	b.addEventListener("click", () => {
		if (openPop && openPop.anchor === b) return closePop();
		const before = values.join(",");
		const panel = h("div", "atr-pop");
		const withLead = items.some((i) => i.lead);
		const draw = () => {
			panel.replaceChildren();
			const allRow = menuItem(withLead ? h("span", "atr-lead") : null, allLabel, null, !values.length);
			allRow.addEventListener("click", () => {
				values = [];
				closePop(); // atrOnClose applies the change
			});
			panel.append(allRow);
			items.forEach((it) => {
				const lead = it.lead ? it.lead() : withLead ? h("span", "atr-lead") : null;
				const row = menuItem(lead, it.label, null, values.includes(it.value));
				row.addEventListener("click", () => {
					values = values.includes(it.value) ? values.filter((v) => v !== it.value) : values.concat(it.value);
					paint();
					draw();
				});
				panel.append(row);
			});
		};
		draw();
		panel.atrOnClose = () => {
			if (values.join(",") !== before) onPick(values.slice());
		};
		openPopover(b, panel);
	});
	paint();
	return b;
};

// Date: value is ISO yyyy-mm-dd; shown as dd-mm-yyyy like the rest of Desk.
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const datePicker = (onPick, required) => {
	const b = h("button", "atr-trigger");
	b.type = "button";
	const lab = h("span", "atr-trigger-label");
	b.append(lab, icon(SVG.calendar));
	let value = "";
	const paint = () => {
		lab.textContent = value ? value.split("-").reverse().join("-") : "dd-mm-yyyy";
		b.classList.toggle("is-empty", !value);
	};
	b.setValue = (v) => {
		value = v || "";
		paint();
	};
	b.getValue = () => value;
	b.limits = () => ({}); // { min, max, range: [from, to] }
	const choose = (v) => {
		closePop();
		if (v === value) return;
		b.setValue(v);
		onPick(v);
	};
	const navBtn = (svg, fn) => {
		const n = h("button", "atr-cal-nav");
		n.type = "button";
		n.innerHTML = svg;
		n.addEventListener("click", fn);
		return n;
	};
	const draw = (panel, month) => {
		panel.replaceChildren();
		const lim = b.limits();
		const range = lim.range || [];
		const today = isoOf(new Date());
		const head = h("div", "atr-cal-head");
		head.append(
			navBtn(SVG.left, () => draw(panel, new Date(month.getFullYear(), month.getMonth() - 1, 1))),
			h("span", "atr-cal-title", MONTHS[month.getMonth()] + " " + month.getFullYear()),
			navBtn(SVG.right, () => draw(panel, new Date(month.getFullYear(), month.getMonth() + 1, 1)))
		);
		const grid = h("div", "atr-cal-grid");
		["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach((d) => grid.append(h("span", "atr-cal-dow", d)));
		const start = new Date(month.getFullYear(), month.getMonth(), 1 - ((month.getDay() + 6) % 7));
		for (let i = 0; i < 42; i++) {
			const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
			const v = isoOf(d);
			const cell = h("button", "atr-cal-day", String(d.getDate()));
			cell.type = "button";
			if (d.getMonth() !== month.getMonth()) cell.classList.add("is-outside");
			if (v === today) cell.classList.add("is-today");
			if (v === value) cell.classList.add("is-selected");
			else if (range[0] && range[1] && v > range[0] && v < range[1]) cell.classList.add("is-range");
			cell.disabled = Boolean((lim.min && v < lim.min) || (lim.max && v > lim.max));
			cell.addEventListener("click", () => choose(v));
			grid.append(cell);
		}
		const foot = h("div", "atr-cal-foot");
		const footBtn = (text, cls, fn) => {
			const f = h("button", "atr-cal-btn" + (cls ? " " + cls : ""), text);
			f.type = "button";
			f.addEventListener("click", fn);
			return f;
		};
		const todayOff = (lim.min && today < lim.min) || (lim.max && today > lim.max);
		foot.append(
			required ? h("span") : footBtn(__("Clear"), "", () => choose("")),
			todayOff ? h("span") : footBtn(__("Today"), "atr-cal-btn--brand", () => choose(today))
		);
		panel.append(head, grid, foot);
	};
	b.addEventListener("click", () => {
		if (openPop && openPop.anchor === b) return closePop();
		const panel = h("div", "atr-pop atr-pop--cal");
		const base = value ? new Date(value + "T00:00:00") : new Date();
		draw(panel, new Date(base.getFullYear(), base.getMonth(), 1));
		openPopover(b, panel);
	});
	paint();
	return b;
};

// Link search (Customer): type to search, pick from the Figma list; × clears.
const linkSearch = (doctype, placeholder, onPick) => {
	const box = h("div", "atr-input");
	const input = h("input");
	input.placeholder = placeholder;
	const clear = h("button", "atr-clear");
	clear.type = "button";
	clear.innerHTML = SVG.close;
	box.append(icon(SVG.search), input, clear);
	let value = "";
	let label = "";
	let timer = null;
	let seq = 0;
	const paint = () => {
		input.value = label;
		clear.style.display = value ? "" : "none";
	};
	box.getValue = () => value;
	box.setValue = (v, l) => {
		value = v || "";
		label = value ? l || label || value : "";
		paint();
		if (value && !l)
			frappe.db.get_value(doctype, value, "customer_name").then((r) => {
				if (value === v && r && r.message && r.message.customer_name) {
					label = r.message.customer_name;
					paint();
				}
			});
	};
	const pick = (v, l) => {
		closePop();
		const changed = v !== value;
		box.setValue(v, l);
		if (changed) onPick(v);
	};
	const show = (results) => {
		const panel = h("div", "atr-pop");
		if (!results.length) panel.append(h("div", "atr-item-empty", __("No customers found")));
		results.forEach((r) => {
			const name = r.label || r.description || r.value;
			const row = menuItem(null, name, name !== r.value ? r.value : null, r.value === value);
			row.addEventListener("mousedown", (e) => e.preventDefault());
			row.addEventListener("click", () => pick(r.value, name));
			panel.append(row);
		});
		openPopover(box, panel);
	};
	const search = () => {
		const mine = ++seq;
		frappe
			.call({ method: "frappe.desk.search.search_link", args: { doctype, txt: input.value.trim(), page_length: 20 }, type: "GET" })
			.then((r) => {
				if (mine === seq && document.activeElement === input) show(r.message || []);
			});
	};
	input.addEventListener("focus", () => {
		input.select();
		search();
	});
	input.addEventListener("input", () => {
		clearTimeout(timer);
		timer = setTimeout(search, 250);
	});
	input.addEventListener("blur", () => setTimeout(() => {
		if (!input.value.trim() && value) pick("", "");
		else paint();
	}, 150));
	clear.addEventListener("click", () => pick("", ""));
	paint();
	return box;
};

const field = (label, control, width) => {
	const f = h("label", "atr-field");
	f.append(h("span", "atr-field-label", label));
	control.style.width = width;
	f.append(control);
	return f;
};
const group = (title, children) => {
	const g = h("div", "atr-group");
	g.append(h("span", "atr-group-title", title));
	const row = h("div", "atr-group-row");
	children.forEach((c) => row.append(c));
	g.append(row);
	return g;
};

const buildFilterBar = (report) => {
	if (report.page.wrapper.find(".atr-bar").length) return;
	const set = (fieldname, value) => report.set_filter_value(fieldname, value || "");
	const ctl = {
		agent: multiDropdown(__("All Agents"), (vals) => set("agent", vals.join(","))),
		customer: linkSearch("Customer", __("Search customer…"), (v) => set("customer", v)),
		from_date: datePicker((v) => set("from_date", v), true),
		to_date: datePicker((v) => set("to_date", v), true),
		based_on: dropdown(null, (v) => set("based_on", v)),
		view: dropdown(null, (v) => set("view", v)),
		status: dropdown(__("All statuses"), (v) => set("status", v)),
		status_category: dropdown(__("All categories"), (v) => set("status_category", v)),
		source_team: dropdown(__("All teams"), (v) => set("source_team", v)),
	};
	ctl.from_date.limits = () => ({ max: ctl.to_date.getValue(), range: [ctl.from_date.getValue(), ctl.to_date.getValue()] });
	ctl.to_date.limits = () => ({ min: ctl.from_date.getValue(), range: [ctl.from_date.getValue(), ctl.to_date.getValue()] });
	const plain = (values) => values.map((v) => ({ value: v, label: __(v) }));
	ctl.based_on.setOptions(plain(["Opening Date", "Resolution Date"]));
	// Expense numbers are for GL Entry readers only (the server enforces the same rule).
	ctl.view.setOptions(plain(["Tickets", "Summary per Agent"].concat(canSeeExpense() ? ["Bajaaj Expense by Company"] : [])));
	ctl.status_category.setOptions(plain(["Open", "Paused", "Resolved"]));
	ctl.source_team.setOptions(plain(["Sales", "Technical"]));

	const bar = h("div", "atr-bar");
	const arrow = h("span", "atr-arrow", "→");
	bar.append(
		group(__("Who"), [field(__("Agent"), ctl.agent, "200px"), field(__("Customer"), ctl.customer, "210px"), field(__("Ka yimid"), ctl.source_team, "140px")]),
		group(__("When"), [
			field(__("From"), ctl.from_date, "150px"),
			arrow,
			field(__("To"), ctl.to_date, "150px"),
			field(__("Date based on"), ctl.based_on, "170px"),
		]),
		group(__("What"), [
			field(__("View"), ctl.view, "190px"),
			field(__("Status"), ctl.status, "170px"),
			field(__("Status category"), ctl.status_category, "170px"),
		])
	);
	report.page.page_form.before(bar);

	report.atr_controls = ctl;
	report.atr_sync = () => {
		Object.keys(ctl).forEach((k) => {
			const v = report.get_filter_value(k) || "";
			if (k === "customer") {
				if (v !== ctl.customer.getValue()) ctl.customer.setValue(v);
			} else ctl[k].setValue(v);
		});
		if (report.atr_gen_btn) report.atr_gen_btn();
	};
	report.atr_sync();

	// Agent dropdown = HD Team "Technical" members only (managed at /helpdesk/teams).
	// Empty/missing team falls back to all active agents — same rule as the server script.
	// (HD Team Member cannot be get_list'ed from the client, so use Helpdesk's own API.)
	new Promise((resolve) => {
		frappe.call({
			method: "helpdesk.helpdesk.doctype.hd_team.hd_team.get_team_members",
			args: { team: "Technical" },
			callback: (r) => resolve(r.message || []),
			error: () => resolve([]),
		});
	})
		.then((members) => {
			const techUsers = (members || []).filter(Boolean);
			const filters = techUsers.length
				? { is_active: 1, name: ["in", techUsers] }
				: { is_active: 1, name: ["!=", "Administrator"] };
			return frappe.db.get_list("HD Agent", {
				fields: ["name", "agent_name"],
				filters,
				order_by: "agent_name asc",
				limit: 500,
			});
		})
		.then((agents) => {
			// The hidden native filter is a Data field now, so values (including comma-separated
			// lists and the ?agent= URL value) apply as-is on the first run — no options race.
			ctl.agent.setOptions(
				agents.map((a) => {
					const label = a.agent_name || a.name;
					return { value: a.name, label, lead: () => h("span", "atr-avatar", initialsOf(label)) };
				})
			);
			ctl.agent.setValue(report.get_filter_value("agent"));
		});
	frappe.db.get_list("HD Ticket Status", { fields: ["name"], order_by: "name asc", limit: 100 }).then((rows) => {
		ctl.status.setOptions(rows.map((r) => ({ value: r.name, label: __(r.name) })));
		ctl.status.setValue(report.get_filter_value("status"));
	});
};

// ---------- Bajaaj expense by company (GL account 5225) ----------
const canSeeExpense = () => frappe.model.can_read("GL Entry");
const BAJAAJ_LIMIT = 10;
const money = (v, currency) => (v == null ? "" : format_currency(v, currency));
// The server sends the section as HTML-escaped JSON inside the report message (hidden by CSS).
const bajaajPayload = (report) => {
	const msg = report.raw_data && report.raw_data.message;
	if (!msg || typeof msg !== "string" || msg.indexOf("atr-baj-data") < 0) return null;
	const node = new DOMParser().parseFromString(msg, "text/html").querySelector(".atr-baj-data");
	try {
		return node ? JSON.parse(node.textContent) : null;
	} catch (e) {
		return null;
	}
};
const renderBajaaj = (report) => {
	const wrapper = report.page.wrapper.get(0);
	const old = wrapper.querySelector(".atr-baj");
	if (old) old.remove();
	const data = bajaajPayload(report);
	const table = wrapper.querySelector(".report-wrapper");
	if (!data || !table) return;
	const ccy = data.currency;
	const box = h("div", "atr-baj");
	const head = h("div", "atr-baj-head");
	head.append(
		h("span", "atr-baj-title", __("Bajaaj expense by company")),
		h("span", "atr-baj-sub", __("{0} in the period · click a company to filter", [money(data.total, ccy)]))
	);
	box.append(head);
	const rows = data.rows || [];
	if (!rows.length) {
		box.append(h("div", "atr-baj-empty", __("No Bajaaj expenses linked to a company in this period.")));
	} else {
		const t = h("table");
		const thead = h("thead");
		const hr = h("tr");
		[
			[__("Company"), ""],
			[__("Expense entries"), "is-num"],
			[__("Total"), "is-num"],
			[__("Tickets"), "is-num"],
			[__("Expense per ticket"), "is-num"],
		].forEach((c) => hr.append(h("th", c[1], c[0])));
		thead.append(hr);
		const tbody = h("tbody");
		const current = report.get_filter_value("customer");
		rows.forEach((r, i) => {
			const tr = h("tr", r.customer === current ? "is-active" : "");
			if (i >= BAJAAJ_LIMIT) tr.hidden = true;
			const name = h("td");
			name.append(document.createTextNode(r.company || r.customer));
			if (r.company && r.company !== r.customer) name.append(h("span", "atr-baj-id", r.customer));
			tr.append(
				name,
				h("td", "is-num", String(r.entries)),
				h("td", "is-num", money(r.amount, ccy)),
				h("td", "is-num", String(r.tickets)),
				h("td", "is-num", r.per_ticket == null ? "—" : money(r.per_ticket, ccy))
			);
			tr.addEventListener("click", () =>
				report.set_filter_value("customer", r.customer === current ? "" : r.customer)
			);
			tbody.append(tr);
		});
		t.append(thead, tbody);
		box.append(t);
		const foot = h("div", "atr-baj-foot");
		const unl = data.unlinked || {};
		const left = h("span", unl.count ? "atr-baj-unlinked" : "");
		if (unl.count) {
			left.textContent = __("Unlinked expenses: {0}, total {1}", [unl.count, money(unl.total, ccy)]);
			const open = h("a", null, __("Open them"));
			open.addEventListener("click", () => {
				const bills = (unl.vouchers || []).filter((v) => v.doctype === "Expense Bill").map((v) => v.name);
				frappe.route_options = { name: ["in", bills] };
				frappe.set_route("List", "Expense Bill");
			});
			left.append(open);
		}
		foot.append(left);
		if (rows.length > BAJAAJ_LIMIT) {
			const more = h("button", null, __("Show all {0}", [rows.length]));
			more.type = "button";
			more.addEventListener("click", () => {
				tbody.querySelectorAll("tr[hidden]").forEach((tr) => (tr.hidden = false));
				more.remove();
			});
			foot.append(more);
		}
		if (unl.count || rows.length > BAJAAJ_LIMIT) box.append(foot);
	}
	// Hidden until the "Bajaaj Expense" card is clicked; stays open across refreshes (e.g. after picking a company).
	box.hidden = !report.atr_baj_open;
	// Directly under the KPI cards, above the chart.
	const chart = wrapper.querySelector(".chart-wrapper");
	(chart && chart.offsetParent !== null ? chart : table).before(box);
	const card = [...wrapper.querySelectorAll(".report-summary .summary-item")].find(
		(el) => (el.querySelector(".summary-label") || {}).textContent === __("Bajaaj Expense")
	);
	if (!card) return;
	card.classList.add("atr-baj-card");
	card.classList.toggle("is-open", !box.hidden);
	card.title = __("Show Bajaaj expense by company");
	card.onclick = () => {
		report.atr_baj_open = box.hidden;
		box.hidden = !report.atr_baj_open;
		card.classList.toggle("is-open", report.atr_baj_open);
		if (report.atr_baj_open) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
	};
};

// Status / SLA cells → Figma Pill with a coloured dot.
const STATUS_TONE = { Open: "orange", Paused: "gray", Resolved: "green" };
const SLA_TONE = { Fulfilled: "green", Failed: "red" };
const pill = (tone, html) => `<span class="atr-pill atr-pill--${tone}">${html}</span>`;

// Ticket view: each shown column carries a second line from a hidden field, so nothing is dropped.
const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
const two = (main, sub) =>
	`<div class="atr-two"><div class="atr-two__main">${main}</div>${sub ? `<div class="atr-two__sub">${sub}</div>` : ""}</div>`;
const muted = (text) => `<span class="atr-muted">${esc(text)}</span>`;
const hours = (v) => (v == null || v === "" ? "—" : format_number(v, null, 2) + " h");
const TWO_LINE = {
	name: (d) =>
		two(
			`<a class="atr-link" href="/helpdesk/tickets/${encodeURIComponent(d.name)}" target="_top">${esc(d.name)}</a>`,
			d.opening_date ? esc(frappe.datetime.str_to_user(d.opening_date)) : ""
		),
	subject: (d) =>
		`<div class="atr-two" title="${esc(d.subject)}"><div class="atr-two__main">${esc(d.subject)}</div>` +
		`<div class="atr-two__sub">${esc([d.ticket_type, d.priority].filter(Boolean).join(" · "))}</div></div>`,
	status: (d) =>
		two(
			d.status ? pill(STATUS_TONE[d.category] || "gray", esc(d.status)) : "",
			d.agreement_status
				? `<span class="atr-dot" style="--atr-dot:${{ Fulfilled: "#1db487", Failed: "#be2f33" }[d.agreement_status] || "#8f9193"}"></span>SLA ${esc(d.agreement_status)}`
				: ""
		),
	company: (d) => two(esc(d.company || d.customer || "—"), d.company && d.customer !== d.company ? esc(d.customer) : ""),
	primary_contact: (d) => {
		const main = d.primary_contact || d.contact;
		return two(main ? esc(main) : muted("—"), d.contact && d.contact !== main ? esc(d.contact) : "");
	},
	caller_name: (d) => two(d.caller_name ? esc(d.caller_name) : muted("—"), esc(d.caller_phone)),
	// Bajaaj: amount linked to this ticket, else the company's average per ticket (expenses that name no ticket).
	bajaaj_expense: (d) => {
		const linked = d.bajaaj_expense || 0;
		const share = d.bajaaj_share || 0;
		if (!linked && !share) return muted("—");
		const sub = linked && share ? __("incl. {0} company avg", [money(share, d.currency)]) : linked ? __("linked") : __("company avg");
		return `<div class="atr-two" title="${esc(__("Linked to this ticket: {0} · Company average share: {1}", [money(linked, d.currency), money(share, d.currency)]))}">` +
			`<div class="atr-two__main">${linked ? "" : "≈ "}${esc(money(linked + share, d.currency))}</div><div class="atr-two__sub">${esc(sub)}</div></div>`;
	},
	first_response_hours: (d) =>
		two(
			`${hours(d.first_response_hours)} <span class="atr-muted">first reply</span>`,
			d.resolution_date ? `${hours(d.resolution_hours)} to resolve` : __("Not resolved")
		),
};

frappe.query_reports["Agent Ticket Report"] = {
	filters: [
		{
			// Empty = all agents. One HD Agent, or a comma-separated list for several at once
			// (the custom bar writes it; ?agent=a or ?agent=a,b in the URL works too).
			fieldname: "agent",
			label: __("Agent"),
			fieldtype: "Data",
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.month_start(),
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			reqd: 1,
			default: frappe.datetime.get_today(),
		},
		{
			fieldname: "view",
			label: __("View"),
			fieldtype: "Select",
			options: ["Tickets", "Summary per Agent", "Bajaaj Expense by Company"],
			default: "Tickets",
		},
		{
			fieldname: "based_on",
			label: __("Date Based On"),
			fieldtype: "Select",
			options: ["Opening Date", "Resolution Date"],
			default: "Opening Date",
		},
		{
			fieldname: "customer",
			label: __("Customer"),
			fieldtype: "Link",
			options: "Customer",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Link",
			options: "HD Ticket Status",
		},
		{
			fieldname: "status_category",
			label: __("Status Category"),
			fieldtype: "Select",
			options: ["", "Open", "Paused", "Resolved"],
		},
		{
			fieldname: "source_team",
			label: __("Ka yimid"),
			fieldtype: "Select",
			options: ["", "Sales", "Technical"],
		},
	],

	onload(report) {
		injectFigmaStyles();
		buildFilterBar(report);
		const refresh = report.refresh.bind(report);
		report.refresh = (...args) => {
			const result = refresh(...args);
			Promise.resolve(result).then(() => renderBajaaj(report));
			return result;
		};

		report.page.wrapper.on("click", ".atr-customer-link", (e) => {
			e.preventDefault();
			const customer = $(e.currentTarget).attr("data-customer");
			if (customer) report.set_filter_value({ customer, view: "Tickets" });
		});

		// Summary per Agent: clicking an agent opens that agent's tickets.
		report.page.wrapper.on("click", ".atr-agent-link", (e) => {
			e.preventDefault();
			const user = $(e.currentTarget).attr("data-agent");
			if (user) report.set_filter_value({ agent: user, view: "Tickets" });
		});

		// Engineer Monthly Report for the chosen agent + From/To (API Server Script yool_engineer_report_generate).
		// Enabled only while exactly ONE agent is selected (the filter can hold a comma-separated list).
		const selectedAgents = () =>
			(report.get_filter_value("agent") || "").split(",").map((s) => s.trim()).filter(Boolean);
		const genBtn = report.page.add_inner_button(__("Generate Engineer Report"), async () => {
			const selected = selectedAgents();
			const from_date = report.get_filter_value("from_date");
			const to_date = report.get_filter_value("to_date");
			if (selected.length !== 1) {
				frappe.msgprint({ title: __("Agent required"), message: __("Please choose exactly one Agent first."), indicator: "orange" });
				return;
			}
			const agent = selected[0];
			if (!from_date || !to_date) return;
			const f = frappe.datetime.str_to_obj(from_date);
			const t = frappe.datetime.str_to_obj(to_date);
			const monthEnd = new Date(f.getFullYear(), f.getMonth() + 1, 0);
			let period_type = "Custom";
			if (f.getDate() === 1 && t.getFullYear() === f.getFullYear() && t.getMonth() === f.getMonth() && t.getDate() === monthEnd.getDate()) {
				period_type = "Month";
			} else if (frappe.datetime.get_diff(to_date, from_date) === 6) {
				period_type = "Week";
			}
			const r = await frappe.call({
				method: "yool_engineer_report_generate",
				args: { agent, from_date, to_date, period_type },
				freeze: true,
				freeze_message: __("Generating engineer report..."),
			});
			if (!r || !r.message) return;
			const url = "/app/engineer-monthly-report/" + encodeURIComponent(r.message);
			// Inside the Helpdesk overlay (iframe) open a new tab; on the Desk page just route there.
			if (window.top !== window.self) window.open(url, "_blank");
			else frappe.set_route("Form", "Engineer Monthly Report", r.message);
		});
		report.atr_gen_btn = () => {
			const single = selectedAgents().length === 1;
			genBtn.prop("disabled", !single).attr("title", single ? "" : __("Select a single agent"));
		};
		report.atr_gen_btn();

		// Team Monthly Report for the whole team + From/To (API Server Script yool_team_report_generate).
		// Managers only; enabled while NO agent is selected (the "All Agents" view, so the team totals
		// match what is on screen). Opens /app/team-monthly-report/<name>.
		if (frappe.user.has_role("Agent Manager") || frappe.user.has_role("System Manager")) {
			const teamBtn = report.page.add_inner_button(__("Generate Team Report"), async () => {
				if (selectedAgents().length) {
					frappe.msgprint({ title: __("All Agents required"), message: __("Clear the Agent filter first — the team report always covers all agents."), indicator: "orange" });
					return;
				}
				const from_date = report.get_filter_value("from_date");
				const to_date = report.get_filter_value("to_date");
				if (!from_date || !to_date) return;
				const r = await frappe.call({
					method: "yool_team_report_generate",
					args: { from_date, to_date },
					freeze: true,
					freeze_message: __("Generating team report..."),
				});
				if (!r || !r.message) return;
				const url = "/app/team-monthly-report/" + encodeURIComponent(r.message);
				if (window.top !== window.self) window.open(url, "_blank");
				else frappe.set_route("Form", "Team Monthly Report", r.message);
			});
			const syncGenBtn = report.atr_gen_btn;
			report.atr_gen_btn = () => {
				syncGenBtn();
				const none = selectedAgents().length === 0;
				teamBtn.prop("disabled", !none).attr("title", none ? "" : __("Clear the Agent filter (All Agents) first"));
			};
			report.atr_gen_btn();
		}
	},

	// Figma table rows: 56px body rows instead of Desk's dense 33px.
	// Columns keep their relative widths but are scaled to the card width, so the table never scrolls sideways.
	get_datatable_options(options) {
		// The wrapper can still be wider than the page while the report first lays out, so also cap it by the
		// viewport (minus the card's 24px side margins and border).
		const wrap = document.querySelector(".report-wrapper");
		const width = Math.min(wrap ? wrap.clientWidth : Infinity, document.documentElement.clientWidth - 50);
		const avail = width - 72; // row-number column + scrollbar
		const cols = (options.columns || []).filter((c) => c && c.width && !c.hidden);
		const total = cols.reduce((s, c) => s + c.width, 0);
		if (avail > 400 && total) {
			const scale = avail / total;
			cols.forEach((c) => (c.width = Math.max(70, Math.floor(c.width * scale))));
		}
		// Two-line cells read left to right, whatever the field type.
		(options.columns || []).forEach((c) => {
			if (c && TWO_LINE[c.id || c.fieldname]) c.align = "left";
		});
		return Object.assign(options, { cellHeight: 56, layout: "fixed" });
	},

	// The detail fields shown as second lines are hidden columns; keep them in exports.
	export_hidden_cols: true,

	after_datatable_render(datatable) {
		if (frappe.query_report && frappe.query_report.atr_sync) frappe.query_report.atr_sync();
		if (frappe.query_report) renderBajaaj(frappe.query_report);
		const wrapper = datatable && datatable.wrapper;
		if (wrapper) wrapper.querySelectorAll(".dt-filter:not([disabled])").forEach((i) => (i.placeholder = __("Search")));
	},

	formatter(value, row, column, data, default_formatter) {
		const isSummaryRow = data && "agent_user" in data;
		if (data && "subject" in data && TWO_LINE[column.fieldname]) return TWO_LINE[column.fieldname](data);
		// Open tickets in the Helpdesk agent UI (top window, so it also works when embedded in Helpdesk).
		if (column.fieldname === "name" && data && data.name && !isSummaryRow) {
			const id = encodeURIComponent(data.name);
			return `<a class="atr-link" href="/helpdesk/tickets/${id}" target="_top">${frappe.utils.escape_html(String(data.name))}</a>`;
		}
		if (column.fieldname === "agent" && isSummaryRow && data.agent_user) {
			return `<a href="#" class="atr-agent-link atr-link" data-agent="${frappe.utils.escape_html(data.agent_user)}">${frappe.utils.escape_html(
				String(data.agent || data.agent_user)
			)}</a>`;
		}
		// Bajaaj Expense by Company: company opens that customer's tickets; Total / Unlinked rows in bold.
		if (data && (data.is_total || data.is_unlinked)) {
			return `<span class="atr-total">${default_formatter(value, row, column, data)}</span>`;
		}
		if (column.fieldname === "company" && data && data.customer && "entries" in data) {
			return `<a href="#" class="atr-customer-link atr-link" data-customer="${frappe.utils.escape_html(data.customer)}">${frappe.utils.escape_html(
				String(data.company || data.customer)
			)}</a>`;
		}
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "assigned_to" && data && data.assigned_to === "Unassigned") {
			value = `<span class="atr-muted">${value}</span>`;
		}
		if (column.fieldname === "agreement_status" && data && data.agreement_status) {
			value = pill(SLA_TONE[data.agreement_status] || "gray", value);
		}
		if (column.fieldname === "status" && data && data.status && !isSummaryRow) {
			value = pill(STATUS_TONE[data.category] || "gray", value);
		}
		if (["customer", "contact", "caller_phone"].includes(column.fieldname) && value) {
			value = `<span class="atr-secondary">${value}</span>`;
		}
		return value;
	},
};
})();
