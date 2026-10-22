# Sidebar & icon survey — my.yool.tech / portal.yool.tech (2026-10-19)

Read-only survey in the logged-in browser (Frappe 16.33.1, ERPNext 16.31.1, HRMS 16.18.1, Helpdesk 1.26.1,
CRM 1.81.0, Raven 2.8.12, easycustomize, qorshe, yshop, sadarsms_erp, et_adms). Figma source: file
`kkmiC7lB8fcrjDcpTrW160` ("UI-dinsg"), page **Icons** (frame `1727:7567`, 177 stroke icons) and Side Menu
`10450:5374`. Screenshots: `screens/survey_*.png` (before) and `screens/*_sidebar.png`, `helpdesk_home_direct.png` (after, injected non-persistently).

## Summary

| # | Surface | DOM hook used by the theme | Nav items | Icons mapped to Figma | Needs icon | Status in package |
|---|---|---|---|---|---|---|
| 1 | Desk workspace sidebar (`/desk/<workspace>`, list, form, report pages) | `.body-sidebar-container(.expanded) .body-sidebar .standard-sidebar-item`, icon `<svg><use href="#icon-NAME">` | 79 workspace sidebars, 151 distinct icon names | 117 | 34 | **Themed** (`desk_theme.css`, app_include_css) |
| 2 | Desk launcher (`/desk`) and `/apps` | `[class*=desktop-wrapper] … [class*=desktop-icon] img[src*="desktop_icons/"]` | 14 top tiles (+9 in Accounting folder, HR/Framework sub-icons) | 21 tile images | 5 (+5 brand logos kept) | **Opt-in** (`desk_launcher_icons.css`, not enabled) |
| 3 | Desk form sidebar (right: Assign, Attachments, Tags, Share) | `.layout-side-section.right` | 4 | – | – | Left stock on purpose (not navigation; forms must not change) |
| 4 | Helpdesk agent sidebar (`/helpdesk/*`) | `.bg-surface-menu-bar` (inline width 224px / 50px), items `div.cursor-pointer[class*=h-7]` | 10 + Collapse | 10 | 0 | **Themed** (`helpdesk_theme.css/js`, after_request) |
| 5 | Helpdesk customer portal (`/helpdesk/my-tickets`, KB) | same `.bg-surface-menu-bar` | 2 + Collapse | 2 | 0 | **Themed** (same files) |
| 6 | Helpdesk Home dashboard (`/helpdesk/home`) | `html.yool-fig-home` + `section.vgl-item` | – | – | – | **Themed** (cards, labels, chart lines) |
| 7 | Frappe CRM sidebar (`/crm/*`) | `.bg-surface-sidebar [data-slot=sidebar-item][data-state]` + `a[href^="/crm/…"]` | 9 + Collapse | 9 | 0 | **Themed** (`crm_theme.css`, after_request) |
| 8 | Website portal sidebar (`/orders`, `/invoices`, `/issues` …) | `.web-sidebar .sidebar-item > a[href]` (`a.active`) | 14 | 13 | 1 (Shipments) | **Themed** (`portal_theme.css`, web_include_css) |
| 9 | `/me` account page | `#icon-edit/lock/web/home/grid/logout` links | 6 | – | – | Not a sidebar; left stock |
| 10 | Raven (`/raven`) | Radix UI channel list (dark theme), not module navigation | channels/members | – | – | **Not themed** — needs a decision (chat app, user-selected dark mode) |

## 1. Desk workspace sidebar — current icon → Figma icon

Workspaces present (79 sidebars in `frappe.boot.workspace_sidebar_item`): Organization, YShop, Accounts Setup,
Payments, Raven, Helpdesk, Frappe CRM, Subcontracting, Stock, Home, Buying, Integrations, Tax & Benefits,
Shift & Attendance, Payroll, Recruitment, HR Setup, Taxes, Banking, Budget, Share Management, Subscription,
Automation, Manufacturing, My Workspaces, Printing, Data, Website, Users, System, Support, Selling, Quality,
Projects, Performance, Leaves, Financial Reports, Expenses, Tenure, Email, CRM, Build, Assets, Invoicing,
Yool Chatwoot, et ADMS, EasyCustomize, SadarSMS ERP, Controller YShop, System Settings, Qorshe, Lead Syncing,
FCRM, FTelephony, Raven AI, Raven Integrations, Raven Bot, Raven Channel Management, Raven Messaging, EDI,
MyPass, HR, Bulk Transaction, Telephony, Communication, Quality Management, ERPNext Integrations, Regional,
Maintenance, Utilities, Setup, Accounts, Contacts, Desk, Geo, Custom, Workflow, Core, Payment Gateways.

Most-used icons: `table` (93 items, mostly report links), `settings` (36), `database` (24), `home` (21),
`wallpaper` (17), `notepad-text` (15), `sheet` (10), `chart` (9), `panel-top` (9), `layout-dashboard` (7).

| Figma icon (layer, node) | Frappe icon names (`#icon-…`) |
|---|---|
| `analytics` — analytics-chart-right-big 1 (1522:19506) | chart, layout-dashboard |
| `arrow_up` — Arrow, Up (1170:19080) | up-arrow |
| `arrows` — Arrows, change (3140:165137) | repeat, repeat-2 |
| `at` — @-email-mail 1 (2630:63092) | at-sign |
| `bell` — Bell,-Notifications 1 (3697:14552) | bell, bell-dot, bell-ring |
| `board` — menu-board-square 1 (1522:19726) | grid-2x2-check, table_2 |
| `browser` — browser-internet-web-text 1 (5943:12027) | panel-top |
| `building` — Hotel, Building 1 (5943:3976) | factory, organization |
| `calendar` — calendar-date 1 (977:17863) | calendar-check, calendar-check-2, calendar-clock, calendar-days, calendar-heart, calendar-range, calendar-sync |
| `cart` — Shopping-Cart 1 (1622:5518) | buying |
| `chart_down` — Business,-Chart 2-Down (1170:19130) | trending-down |
| `chat` — messages-chat-text 1 (1522:19511) | message-1, message-square-reply |
| `checklist` — check-list-checkmark-2 1 (1522:19507) | clipboard-check, list-todo |
| `connect` — connect-arrows-circle 1 (5415:5264) | cable, integration, webhook |
| `desktop` — desktop-computer-pc 1 (5790:23184) | computer, laptop, monitor-check, tv-minimal |
| `doc_text` — document-file-text-two-lines-bottom 1 (3210:166129) | book-open-check, book-open-text, book-text, file-text, notebook-text, notepad-text, scroll-text |
| `docs_album` — documents-files-album-right-top 1 (1522:19508) | kanban |
| `dollar` — Dollar 2 (4882:73375) | badge-cent, banknote-arrow-up, banknote-x, circle-dollar-sign, dollar-sign, money-coins-1 |
| `download` — download-arrow 1 (1590:16679) | arrow-down-from-line |
| `excel` — documents-file-excel 1 (1030:16972) | sheet |
| `globe` — Earth, Home, World 1 (5372:12213) | web, website |
| `graduate` — person-graduate (1622:5610) | graduation-cap |
| `grid` — grid-layout-menu-more 1 (3725:98561) | grid, wallpaper |
| `heading` — text-h1 1 (636:4270) | heading |
| `headphones` — Headphones,-Customer,-support 1 (1522:19509) | support |
| `health` — health-graph-heart 1 (1622:5605) | heart-pulse |
| `house` — Home (4179:26457) | home |
| `idea` — document-idea-light-lamp 1 (1539:187) | lightbulb |
| `invoice_text` — invoice-text 1 (3140:165997) | accounting |
| `link` — attachment-link 1 (636:4265) | link |
| `list` — list-paragraph 1 (636:4262) | list, list-end, list-tree, logs |
| `lock` — lock-line-big-3 1 (2630:63136) | file-lock, lock-keyhole, lock-keyhole-open, user-lock |
| `mail` — letter-mail-3 1 (2630:63104) | mail |
| `package` — Shopping-bag,-Package,-Pack 1 (1622:5566) | stock |
| `pen` — pen-edit-create 1 (1590:16680) | clipboard-pen, edit, notebook-pen, pen-tool, square-pen |
| `receipt` — receipt-currency-dollar-2 1 (3210:166202) | receipt, receipt-text |
| `report` — document-file-chart-analytics-bottom 1 (5860:15145) | table |
| `search` — search-loupe 1 (1522:19745) | search |
| `server` — Server, Databases.6 1 (5837:14102) | database, database-backup, server |
| `settings` — settings 1 (1522:19504) | setting, settings |
| `sliders` — settings-filter 1 (3701:15623) | filter, funnel |
| `star` — Start icon (538:1192) | star |
| `store` — store-modern 1 (3140:166000) | sell |
| `suitcase` — suitcase-job-work-checkmark 1 (6909:85033) | briefcase-business, project, projects |
| `transfer` — Transfer (4179:26449) | move-horizontal |
| `trash` — bin-trash-style-5-vertical-lines 1 (1030:16974) | trash |
| `upload` — cloud-upload 1 (1046:17954) | file-up, import, upload |
| `user` — user (4179:26453) | book-user, circle-user-round, customer, file-user, person-standing, square-user-round, user, user-round, user-round-check, user-round-minus, user-round-plus, user-star |
| `users` — Users 1 (1249:20580) | hr, users, users-round |
| `verified` — check-verified-02 1 (697:5191) | quality |
| `wallet` — wallet (4179:26451) | expenses, liabilities, loan, piggy-bank |
| `warning` — warning (5285:18664) | badge-alert, triangle |

**Needs icon (34, no Figma match — left stock):** align-start-horizontal, arrow-left-to-line,
arrow-right-from-line, assets, caravan, criticize, crm, customization, file-question-mark, flag, folder-tree,
getting-started, git-pull-request-arrow, goal, hammer, inspection-panel, mail-x, milestone, non-profit, orbit,
panel-bottom-close, panel-top-close, plane, pointer, printer, review, split, sprout, square-activity,
thumbs-up, tool, truck, user-cog, videotape.

## 2. Desk launcher (`/desk`, `/apps`) — opt-in

Top tiles: Accounting (folder: Invoicing, Payments, Financial Reports, Accounts Setup, Taxes, Banking, Budget,
Share Management, Subscription), Selling, YShop (letter tile), Buying, Manufacturing, Projects, Quality, Raven,
Helpdesk, Frappe CRM, Subcontracting, Assets, Framework, Frappe HR. Current images: easycustomize
`/assets/easycustomize/icons/desktop_icons/solid/*.svg` (purple 3D style), HRMS `desktop_icons/*.svg`, app logos.

| Tile image | Figma | Tile image | Figma |
|---|---|---|---|
| invoicing | invoice_text | selling | store |
| payments | receipt | buying | cart |
| financial_reports | report | manufacturing | building |
| accounts_setup | settings | projects | suitcase |
| taxes, tax-benefits | percent | quality | verified |
| banking, salary_payout | dollar | expense_claim, budget | wallet |
| hr_setup | settings | leaves | calendar |
| performance | star | recruitment | users |
| shift-attendence | clock | employee_lifecycle | user |

Needs icon: share_management, subscription, subcontracting, assets, YShop (letter tile). Brand logos kept:
Raven, Helpdesk, Frappe CRM, Framework, Frappe HR. The user's Stylus "bigger desk icons" style keeps working.

## 4–6. Helpdesk 1.26 (agent + portal)

| Item | Current (stock Lucide, first path) | Figma |
|---|---|---|
| Search | lucide search `m21 21-4.34…` | search-loupe 1 |
| Notifications | lucide bell `M10.268 21a2…` | Bell,-Notifications 1 |
| Home | lucide house `M15 21v-8a1…` | grid-layout-menu-more 1 (as in Side Menu 10450:5374) |
| Dashboard | lucide layout-dashboard (4 rects) | analytics-chart-right-big 1 |
| Tickets | lucide ticket `M2 9a3 3 0 0 1 0 6v2…` | messages-chat-text 1 |
| Knowledge Base | lucide book-open `M12 7v14` | document-file-text-two-lines-bottom 1 |
| Customers | custom OrganizationsIcon `M4.83144 1.7793…` | bag-shopping-big 1 |
| Contacts | lucide contact-round `M16 2v2 / M17.915 22…` | Users 1 |
| Agent Report (Public View) | emoji 📊 | invoice-checkmark-copy 1 |
| Kanban (Public View) | emoji 🗂️ | documents-files-album-right-top 1 |
| Call Logs (if telephony enabled) | PhoneIcon | phone 1 |
| Collapse | lucide panel arrow | kept stock |
| Portal: Tickets / Knowledge Base | same as above | same as above |

Loader facts: `/helpdesk/*` is `helpdesk/www/helpdesk/index.html` (Vite build output of `desk/index.html`);
it renders only boot data, never `app_include_*`/`web_include_*`. The Helpdesk service worker is scoped to
`/assets/helpdesk/desk/` and does not serve `/helpdesk` navigations, so server-side injection reaches every load.

## 7. Frappe CRM

Notifications → bell, Dashboard → analytics, Leads → user, Deals → dollar, Contacts → users,
Organizations → building, Notes → notes (Documents,-Notes,-Pages 1), Tasks → checklist, Call Logs → phone.

## 8. Website portal sidebar

Projects → suitcase, Request for Quotations → doc_text, Supplier Quotation → invoice_text,
Purchase Orders → cart, Purchase Invoices → receipt, Quotations → invoice_text, Orders → package,
Invoices → receipt, **Shipments → needs icon (no truck in the Figma set)**, Issues → headphones,
Addresses → pin, Timesheets → clock, Material Request → checklist, My Account → user.

## Pre-existing console errors seen during the survey (not caused by the theme)

- Helpdesk `/helpdesk/tickets`: `ReferenceError: Cannot access 'u' before initialization` (more-horizontal chunk) — reproduced with no theme loaded.
- CRM first load: router `Cannot read properties of undefined (reading 'href')` — raised at page load, before the CSS was injected.
