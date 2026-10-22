# Yooltech Helpdesk customizations

Everything Yooltech built on top of Frappe Helpdesk for `my.yool.tech` / `portal.yool.tech`, packaged as one
installable Frappe app (`yooltech/yool_theme`). Nothing outside `yooltech/` is changed: the Helpdesk code in this
repository stays exactly as it is.

Target stack: Frappe 16, Helpdesk 1.26 (this fork), ERPNext (Customer, Employee, GL Entry). Somali (Soomaali)
is the working language of the UI texts and customer messages; most labels are bilingual.

| Folder | What it is |
|---|---|
| `yooltech/yool_theme/` | The Frappe app: Figma theme (CSS/JS + `after_request` hook) **and** all site customizations as fixtures |
| `yooltech/yool_theme/yool_theme/fixtures/` | Schema and code records, re-imported by every `bench migrate` |
| `yooltech/yool_theme/yool_theme/seed/records.json` | Data-like records, inserted only when missing (never overwritten) |
| `yooltech/yool_theme/yool_theme/install.py` | before/after install + migrate steps (ordering, seeding) |
| `yooltech/yool_theme/yool_theme/public/yooltech_files/` | Word templates + logos used by the monthly reports |
| `yooltech/source/` | Read-only mirror of every script (same text as the fixtures) for code review and diffs |
| `yooltech/yool_theme/tools/scrub_check.py` | Secret / phone / e-mail checker, run before every commit |

## Features

### 1. Agent Ticket Report (`/app/query-report/Agent Ticket Report`)
Script Report (non-standard, `report_script` + `javascript` stored in the Report record) for Agent Manager /
System Manager. Per-agent and all-agents ticket counts, status mix, resolution times, ticket types, company
("by company") breakdown and, for users who can read GL Entry, Bajaaj/transport expenses from the
`Expense Bill` DocType (EasyCustomize app; skipped when not installed). Multi-select agent filter (`?agent=a,b`),
"Ka yimid / Raised by team" column + filter (Sales / Technical). Buttons "Generate Engineer Report" (exactly one
agent) and "Generate Team Report" (all agents). Styled with the Figma tokens (route-scoped CSS).
It also opens inside Helpdesk: public **HD View "Agent Report"** (`VIEW-HD Ticket-1237`) appears in the agent
sidebar, and **HD Form Script "Agent Report Sidebar Button"** overlays the report when that view is open.

### 2. Ticket Kanban (Helpdesk sidebar "Kanban")
Helpdesk 1.26 has no Kanban renderer, so this is the public **HD View "Kanban"** (`VIEW-HD Ticket-1239`) +
**HD Form Script "Ticket Kanban"** (one large script). Columns = HD Ticket Status; labels / colors / order /
hidden columns are stored in the custom Single **HD Kanban Settings** (`config`, JSON), never in the status
records. Per-user collapsed columns and order are saved in Frappe User Settings (`HD Ticket` → `yool_kanban`).
Drag and drop changes the status (every status change can message the customer, see §3), a Preview panel
(API Server Script **Yool Ticket Preview**, polled every 20 s via `check=1`), a new-ticket modal (company,
caller, Team picker Sales/Technical, assign to), WhatsApp pause switch, multi-select ticket-type picker with a
"+ Add" row that creates HD Ticket Types, and Who → Team filters.

### 3. Chatwoot / WhatsApp integration (module "Yool Chatwoot")
- DocTypes: **Chatwoot Settings** (Single) + child tables **Chatwoot Agent Map**, **Chatwoot Status Message**
  (legacy templates, no longer used), log **Chatwoot Sync Log** (`CWL-`).
- **Chatwoot API** (API, `chatwoot_api`): the only door to Chatwoot. Reads the token from Password fields,
  masks secrets in Error Log, rate limit, JOOJI (STOP) opt-out, test-number mode, WhatsApp pause, one Sync Log
  row per request. Actions used by the scripts below (`send_customer_message`, `send_agent_message`,
  `ensure_conversation`, `setup_webhook`, ...).
- **Chatwoot Webhook** (API, `chatwoot_webhook_<webhook_key>`, guest) creates/links tickets from Chatwoot
  conversations labelled `ticket`; **Chatwoot Webhook Old URL** is a decoy that only logs keyless calls;
  **Chatwoot Poll** (cron */10) is the safety net for missed webhooks; **Chatwoot Inbound** is the old
  Supabase-bridge entry point, kept **disabled**.
- **HD Ticket Chatwoot Link** (After Insert): links a new ticket to the caller's WhatsApp conversation, creates
  one when missing and sends one welcome message.
- **HD Ticket Chatwoot Sync** (After Save): on every status change sends ONE public **Somali** message to the
  customer, e.g. `Codsigaaga #<id> (<subject>) ... — Yooltech Support`. Works for Somali (+252) and
  international (E.164) numbers.
- **ToDo Chatwoot Agent Notify** (ToDo After Insert): the assigned agent gets a WhatsApp brief.
- **Chatwoot Message Templates** (API): get/save templates + the global WhatsApp pause.
- Client Scripts **Chatwoot Settings - Buttons** ("Test connection", "Load agents from Chatwoot") and
  **Chatwoot Sync Log - Retry**.
- HD Ticket custom fields `chatwoot_*` (section "Chatwoot") and `source` (Select, "Chatwoot").

### 4. Caller validation and company autofill
Custom fields on HD Ticket: `erp_customer` (Link Customer, "Shirkadda"), `erp_customer_name`,
`primary_contact_name`, `caller_name`, `caller_phone`, `caller_role`, shown through **HD Ticket Template
"Default"** (Helpdesk renders template fields above Subject on New Ticket and under "Ticket Info").
**HD Ticket Caller Validation** (Before Save) requires caller name/phone on agent-created tickets, keeps
`customer` and `erp_customer` in sync, and normalizes phones: Somali local numbers become `+252XXXXXXXXX`,
international numbers are accepted as E.164 (`+`/`00`, 8–15 digits). **Yool Caller Defaults** (API) and
**HD Form Script "Caller Autofill"** fill company / contact / caller on the agent and portal new-ticket forms
(portal users only ever get their own Customer). Property Setter
`HD Ticket-raised_outside_working_hours-default = 0` is required by Frappe 16 once HD Ticket has custom fields.

### 5. Engineer Monthly Report (`EMR-YYYY-#####`)
DocType **Engineer Monthly Report** + children **Engineer Report Activity / Challenge / Feedback**. Engineers
see only their own (Permission Query **Engineer Monthly Report Permission**); status Draft → Submitted →
Approved (**Engineer Monthly Report Validate**, which also fills activities from the engineer's tickets:
solved_by, time_spent, Bajaaj cost). APIs **Yool Engineer Report Generate / Generate All / Refresh**
(Generate All = every member of HD Team "Technical"). Client Scripts **... Dashboard** (Figma dashboard in the
HTML field `ui_dashboard`), **... Form**, **... Downloads** (Word via docxtemplater 3.70.1 + PizZip 3.3.0 from
CDNs, template `/private/files/template_engineer_report.docx`). **Print Format "Engineer Monthly Report"**
(default). HD Ticket custom fields `solved_by` (Office / Visit / WhatsApp) and `time_spent` (Data `h:mm`,
normalized by **HD Ticket Time Spent**).

### 6. Team Monthly Report (`TMR-YYYY-#####`, managers only)
DocType **Team Monthly Report** + children **Team Report Engineer / Issue Type / Customer / Challenge /
Feedback / EMR Link**. **Team Monthly Report Validate** (fill + Draft → Submitted → Approved), APIs **Yool Team
Report Generate / Refresh**, Client Scripts **Team Monthly Report Dashboard / Form / Downloads** (Word template
`/private/files/template_team_report.docx`, Somali "XAFIISKA FARSAMADA" layout), **Print Format "Team Monthly
Report"** (cover `/files/tmr_cover_logo.png`).

### 7. Ticket types: list, multi-select, required on close
45 HD Ticket Types (seeded, e.g. "POS Training", "Printer Issue", "Doctor Training"). Child DocType
**HD Ticket Type Item** + custom field `ticket_types` (Table MultiSelect, after `ticket_type`). **HD Ticket Type
Required** (Before Save) keeps `ticket_type` = first row of `ticket_types` (and the other way round) and blocks
moving a ticket to a Resolved-category status without a real type ("Cancelled" is exempt). Reports read the
primary `ticket_type`.

### 8. Teams: Technical scoping and Sales intake
HD Team **Technical** is the single place that decides who is a technical agent: the Agent Ticket Report agent
list / per-agent rows, Kanban agent lists, EMR "Generate All" and the TMR engineer rows read it (empty team →
all active agents). HD Team **Sales**: custom field `source_team` ("Ka yimid / Raised by team", Sales /
Technical, after `agent_group`); **HD Ticket Source Team** (Before Save, new tickets) defaults it to the
creator's team; **HD Ticket Sales Alert** (After Insert) sends ONE WhatsApp brief about every new Sales ticket
to the Technical team number. Team members are **not** shipped (see Configuration).

**Assigned needs an engineer**: **HD Ticket Assigned Requires Engineer** (Before Save) blocks a status change
INTO "Assigned" unless an assignee (`_assign` / open ToDo; on insert the Kanban's `yool_assign_to`) is a
Technical member (empty team = no check). The Kanban asks first: drag (or preview Status) to Assigned opens
"Dooro injineerka / Assign engineer" (single-select of Technical members); OK assigns via
`frappe.desk.form.assign_to.add`, then moves; Cancel leaves the card; the server error reopens the modal and
retries once. New-ticket form: Column = Assigned makes "Assign to" required. HD Ticket Chatwoot Sync's Assigned
message names the engineer at send time: "... waxaa loo xilsaaray injineerkeena <full name> (<+252… phone>) ..."
(User mobile_no / phone, else the active Employee's cell_number; no phone = no parentheses).

**Sales lane**: HD Ticket Status **Sales** (category Open; Kanban column label "SALES" from HD Kanban Settings,
shown before CUSUB). HD Ticket Source Team puts new Sales tickets there instead of the default new status, and
keeps them there when Helpdesk's own "customer replied" reset would move them back to New; the Technical team
drags them on to Assigned / In Progress. HD Ticket Chatwoot Sync sends no customer message for a change INTO
Sales. Team numbers: Chatwoot Settings `sales_alert_tech_phone` ("Numberka Kooxda Technical (WhatsApp)",
receives the alert; empty = no alert + a Skipped Sync Log row) and `sales_alert_sales_phone` ("Numberka Kooxda
Sales", shown in the alert), normalized by **Chatwoot Settings Team Numbers** (Before Save, same rule as caller
phones). Managers edit them in the Kanban: column ⋮ menu or the WhatsApp switch menu → "⚙ Team numbers /
Numbarrada kooxaha" (API `chatwoot_message_templates` action `team_numbers`). **Sender inbox**: Chatwoot
Settings `sales_alert_inbox_id` ("Sales alert inbox (Chatwoot)", Kanban "Inbox-ka Sales (Chatwoot)", a select of
the Chatwoot inboxes) = the inbox of the Sales WhatsApp number the alert is sent FROM; empty = `default_inbox_id`.
The Chatwoot API door's `send_agent_message` / `ensure_conversation` take an optional `inbox_id` and only reuse a
conversation IN that inbox (a contact can have one per inbox); with `keep_open` an already-open conversation there
(a live Sales ↔ Technical chat) is not resolved after the alert. Customer messages and assignment alerts stay on
the default inbox.

### 9. Figma theme
- HD Form Scripts **Helpdesk Figma Theme** (new-ticket page) and **Helpdesk Figma Theme Ticket** (ticket page),
  same code: restyle the Helpdesk agent sidebar (Figma Side Menu 10450:5374, Manrope, brand `#1db487`, Figma
  icons) and the Home dashboard. They only load once a ticket/Kanban/new-ticket page has been opened.
- The `yool_theme` app itself (`app_include_*`, `web_include_css`, `after_request` hook) themes Desk, Helpdesk
  (including a direct load of `/helpdesk/home`), CRM and the website portal sidebar. See
  `yooltech/yool_theme/README.md`. With the app installed the two HD Form Scripts can be disabled.

## Requirements

- Frappe 16, Helpdesk 1.26, ERPNext (Customer / Employee / GL Entry are referenced).
- Server Scripts enabled: `bench set-config -g server_script_enabled 1`.
- Optional: EasyCustomize app (`Expense Bill`) for Bajaaj costs; Chatwoot 4.x with a WhatsApp inbox.

## Install (new site)

```bash
cd ~/frappe-bench
bench get-app https://github.com/yt-easytouch/helpdesk --branch <branch>   # if Helpdesk is not there yet
# the app lives in a sub-folder of this repo:
cp -r apps/helpdesk/yooltech/yool_theme apps/yool_theme   # or: git clone this repo elsewhere and copy the folder
bench pip install -e apps/yool_theme
grep -qx yool_theme sites/apps.txt || echo yool_theme >> sites/apps.txt
bench --site <site> backup
bench --site <site> install-app yool_theme      # before_install + fixtures + after_install seeding
bench --site <site> migrate                     # safe to repeat; re-imports fixtures in dependency order
bench build --app yool_theme && bench --site <site> clear-cache && bench restart
```

What install does:
1. `before_install` / `before_migrate`: creates Module Def "Yool Chatwoot" and the HD Ticket Property Setter.
2. Frappe imports `fixtures/*.json` (Module Def, 17 DocTypes, Property Setter, 31 Custom Fields, 25 Server
   Scripts, 8 Client Scripts, 5 HD Form Scripts, 2 Print Formats, 1 Report, 2 HD Views).
3. `after_install` / `after_migrate`: re-imports the same files **in dependency order** (Frappe's own pass is
   unordered, so a fresh site may skip some files the first time), then seeds — only when missing — the 45
   ticket types, HD Ticket Status "Sales", HD Teams Technical/Sales (no members), the 7 HD Ticket Template "Default" rows, the default
   Kanban column config, the two Word templates + two logos as File records, and `Expense Bill.hd_ticket`
   when the Expense Bill DocType exists.

Fixtures keep their record names (e.g. `VIEW-HD Ticket-1237/1239`), because the scripts refer to them.

## Configuration after install (admin, never in git)

| Where | What |
|---|---|
| Chatwoot Settings | `enabled`, `base_url`, `account_id`, `default_inbox_id`, `api_token`, `webhook_secret`, `webhook_key`, `internal_key`, `helpdesk_url`, labels, Agent Map (Helpdesk user ↔ Chatwoot agent), `send_customer_messages`, `notify_agents`, `whatsapp_paused`, `max_messages_per_minute`, `test_numbers`, welcome / agent message texts, **`sales_alert_tech_phone`**, **`sales_alert_sales_phone`** and **`sales_alert_inbox_id`** |
| Chatwoot webhook URL | The fixture ships the Server Script "Chatwoot Webhook" with api_method `chatwoot_webhook_change_me`. Rename it to `chatwoot_webhook_<random secret>` on each site (the suffix is a capability secret - never commit the real one), then run `setup_webhook`. |
| Chatwoot webhook | System Manager: `POST /api/method/chatwoot_api` with `action=setup_webhook` registers `/api/method/chatwoot_webhook_<webhook_key>` in Chatwoot; "Test connection" / "Load agents from Chatwoot" buttons on Chatwoot Settings |
| Helpdesk → Settings → Teams | Members of **Technical** and **Sales** (staff are not shipped) |
| Users / Employees | Agent mobile numbers (for assignment WhatsApp), `Employee.user_id` (for Bajaaj costs) |
| HD Kanban Settings | Column labels / colors / hidden (Kanban "Columns" dialog) |
| Agent Ticket Report | Letter Head "Yooltech" is referenced; create it or clear the field |

Keys, tokens and phone numbers are entered in the UI only. **Live safety**: with `enabled` and
`send_customer_messages` on and `test_numbers` empty, every ticket status change messages the real customer.
Fill `test_numbers` (only these numbers get messages) while testing.

## Upgrade

Pull the new commit, then `bench --site <site> migrate && bench build --app yool_theme && bench restart`.
Fixture records (scripts, DocTypes, custom fields, views, print formats, report) are **overwritten** by the repo
version on every migrate — edit them in git, not on the site. Seeded records are never overwritten.

To capture changes made on a site: `bench --site <site> export-fixtures --app yool_theme` (exports only the
names listed in `hooks.py`), then **run `python3 yooltech/yool_theme/tools/scrub_check.py yooltech`** and
re-apply the documented scrubs (see below) before committing. Regenerate `yooltech/source/` from the fixtures.

## Rollback

- Fast, no code change: disable the records — Server Script `disabled = 1`, Client Script / HD Form Script
  `enabled = 0`, HD View `public = 0`. Nothing else depends on them.
- Theme only: comment out the include / `after_request` lines in `hooks.py`, `clear-cache`, `restart`.
- Full: restore the backup taken before install. `bench --site <site> uninstall-app yool_theme` removes the app
  code but **not** the fixture records (they belong to the Helpdesk / Yool Chatwoot modules) and not the data.

## Installing on my.yool.tech itself (currently configured by hand)

The fixtures equal the live records except for the scrubs below, so a migrate only rewrites them. Immediately
after the first migrate check **Chatwoot Settings → Numberka Kooxda Technical (WhatsApp) / Numberka Kooxda
Sales** (live site: already set). Teams, ticket types, the Sales status, templates and Kanban config already
exist and are left alone.

## Differences from the live site (scrubs)

| Item | Repo version |
|---|---|
| Chatwoot Settings `sales_alert_*` | values (team phone numbers, Sales sender inbox id) are not shipped; set them after install |
| Phone examples in validation messages (HD Ticket Caller Validation, Ticket Kanban, Chatwoot API comment) | `+2526XXXXXXXX`, `06XXXXXXXX`, `+44XXXXXXXXXX` |
| HD Teams | no members, no WhatsApp group id, no assignment rule (Helpdesk creates the rule) |
| Word templates | author metadata set to "Yooltech"; unused ink/signature parts removed from the team template |
| `app_email` / authors | `user@example.com` |

## Pre-existing on the live site, not part of this package

- Property Setter that makes `HD Ticket.customer` link to ERPNext Customer (needed by the company features).
- Role / Role Profile "Technical Team" (2024), Custom DocPerms on GL Entry, Easytouch "HD Ticket
  Notification" rules, the Helpdesk-generated Assignment Rules "Technical/Sales - Support Rotation".
- Auto-generated records: the Scheduled Job Type of "Chatwoot Poll" (recreated from the Server Script).

## Not exportable / not included

- Secrets and settings values (Chatwoot Settings singleton), HD Team members, User / Employee / HD Agent records.
- Data changes made on the live site: ticket-type backfill of October 2026 tickets, `Expense Bill.hd_ticket`
  backfill, Employee `user_id` links, disabled Easytouch notification rules.
- Per-user Kanban layouts (User Settings) and Chatwoot-side configuration (inbox, webhook, the Chatwoot server).
- Proposed but never created: two Website Route Redirects for a direct `/helpdesk/home` theme bounce (the app's
  `after_request` hook makes them unnecessary).
- The old Supabase Edge Function bridge (obsolete; replaced by "Chatwoot Webhook").
- Customer data of any kind: sample reports, CSVs, screenshots and test outputs stay out of this repository.
