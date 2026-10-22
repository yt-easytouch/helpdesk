#!/usr/bin/env python3
"""Regenerate the Figma icon blocks inside yool_theme/public/css/*.css.

Icons: yool_theme/public/icons/figma/<key>.svg, exported from Figma file kkmiC7lB8fcrjDcpTrW160
("UI-dinsg"), page "Icons" (frame 1727:7567); _index.json lists the Figma layer name + node id per key.
Each mapped nav item gets its stock glyph hidden and the Figma glyph drawn as a currentColor CSS mask
(data-URI), so no JavaScript is needed to show icons.

Usage:  python3 tools/build_icons.py          (run from the repo root; rewrites the <yool:icons> blocks
                                                and public/css/desk_launcher_icons.css)
        python3 tools/build_icons.py --report  (also prints the Desk icon names that have no Figma match)
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "yool_theme" / "public"
ICONS = PUB / "icons" / "figma"
CSS = PUB / "css"

# --------------------------------------------------------------------------------------------
# Desk (Frappe 16 workspace sidebar): Frappe icon name (<use href="#icon-NAME">) -> Figma key.
# Only confident semantic matches; everything else stays stock and is listed in SURVEY.md.
# --------------------------------------------------------------------------------------------
DESK = {
	"home": "house", "search": "search", "bell": "bell", "bell-dot": "bell", "bell-ring": "bell",
	"chart": "analytics", "layout-dashboard": "analytics",
	"settings": "settings", "setting": "settings",
	"users": "users", "users-round": "users", "hr": "users",
	"user": "user", "user-round": "user", "circle-user-round": "user", "customer": "user",
	"square-user-round": "user", "user-round-check": "user", "user-round-plus": "user",
	"user-round-minus": "user", "user-star": "user", "person-standing": "user", "file-user": "user",
	"book-user": "user",
	"receipt-text": "receipt", "receipt": "receipt", "accounting": "invoice_text",
	"sell": "store", "buying": "cart", "stock": "package",
	"mail": "mail", "at-sign": "at",
	"calendar-clock": "calendar", "calendar-range": "calendar", "calendar-check": "calendar",
	"calendar-days": "calendar", "calendar-check-2": "calendar", "calendar-heart": "calendar",
	"calendar-sync": "calendar",
	"lock-keyhole": "lock", "lock-keyhole-open": "lock", "user-lock": "lock", "file-lock": "lock",
	"web": "globe", "website": "globe",
	"integration": "connect", "webhook": "connect", "cable": "connect", "link": "link",
	"list-todo": "checklist", "clipboard-check": "checklist",
	"organization": "building", "factory": "building",
	"database": "server", "server": "server", "database-backup": "server",
	"computer": "desktop", "laptop": "desktop", "tv-minimal": "desktop", "monitor-check": "desktop",
	"upload": "upload", "file-up": "upload", "import": "upload", "arrow-down-from-line": "download",
	"trash": "trash",
	"square-pen": "pen", "pen-tool": "pen", "notebook-pen": "pen", "clipboard-pen": "pen", "edit": "pen",
	"list": "list", "logs": "list", "list-tree": "list", "list-end": "list",
	"heading": "heading",
	"notepad-text": "doc_text", "file-text": "doc_text", "scroll-text": "doc_text", "notebook-text": "doc_text",
	"book-text": "doc_text", "book-open-text": "doc_text", "book-open-check": "doc_text",
	"sheet": "excel", "table": "report", "table_2": "board", "grid-2x2-check": "board",
	"wallpaper": "grid", "panel-top": "browser",
	"money-coins-1": "dollar", "dollar-sign": "dollar", "circle-dollar-sign": "dollar", "badge-cent": "dollar",
	"banknote-arrow-up": "dollar", "banknote-x": "dollar",
	"piggy-bank": "wallet", "loan": "wallet", "liabilities": "wallet", "expenses": "wallet",
	"support": "headphones", "message-1": "chat", "message-square-reply": "chat",
	"quality": "verified", "project": "suitcase", "projects": "suitcase", "briefcase-business": "suitcase",
	"star": "star", "graduation-cap": "graduate", "lightbulb": "idea", "heart-pulse": "health",
	"trending-down": "chart_down", "up-arrow": "arrow_up",
	"repeat": "arrows", "repeat-2": "arrows", "move-horizontal": "transfer",
	"triangle": "warning", "badge-alert": "warning",
	"filter": "sliders", "funnel": "sliders", "kanban": "docs_album", "grid": "grid",
}

# Icon names seen in the live site's workspace sidebars (frappe.boot.workspace_sidebar_item items +
# header_icon, 2026-10-19 survey) - used only for the --report "needs icon" list.
SURVEYED = """table settings database home wallpaper notepad-text sheet chart panel-top layout-dashboard tool
money-coins-1 stock receipt-text book-text users move-horizontal arrow-left-to-line accounting getting-started
organization user-round-check mail arrow-right-from-line book-open-text liabilities bell-dot user-lock criticize
list-todo calendar-clock web clipboard-check scroll-text customer list-tree grid-2x2-check sell goal file-user
book-user lock-keyhole-open folder-tree truck caravan git-pull-request-arrow cable webhook integration badge-alert
calendar-range pointer calendar-check banknote-arrow-up loan piggy-bank banknote-x kanban user-round-plus
circle-user-round videotape file-text align-start-horizontal square-user-round panel-bottom-close panel-top-close
triangle notebook-text book-open-check split link briefcase-business badge-cent list circle-dollar-sign user-cog
flag repeat-2 calendar-sync bell-ring factory person-standing printer heading pen-tool import file-up square-pen
database-backup trash notebook-pen customization user lock-keyhole file-lock heart-pulse bell server logs
file-question-mark calendar-days calendar-check-2 receipt computer inspection-panel review square-activity
thumbs-up projects orbit up-arrow graduation-cap clipboard-pen setting calendar-heart dollar-sign upload
arrow-down-from-line plane user-star user-round-minus message-square-reply at-sign list-end mail-x users-round
lightbulb funnel tv-minimal laptop trending-down sprout
web message-1 support filter milestone hr repeat user-round website monitor-check quality project star non-profit
expenses crm hammer assets buying search""".split()

# --------------------------------------------------------------------------------------------
# Helpdesk 1.26 agent + customer portal sidebar: Figma key, labels (data-yool-label, set by JS),
# path prefixes (stock Lucide glyph, then the Figma glyph the HD Form Script overlay swaps in).
# --------------------------------------------------------------------------------------------
HELPDESK = [
	("search", ["Search"], ['path[d^="m21 21-4.34"]', 'path[d^="M16.6667 16.6667L13.375"]']),
	("bell", ["Notifications"], ['path[d^="M10.268 21a2"]']),
	("grid", ["Home"], ['path[d^="M15 21v-8a1"]', 'path[d^="M16.6667 12.9583H12.5"]']),
	("analytics", ["Dashboard"], ['rect[width="7"][height="9"][x="3"][y="3"]', 'path[d^="M12.5 17.0833H16.25"]']),
	("chat", ["Tickets"], ['path[d^="M2 9a3 3 0 0 1 0 6v2"]', 'path[d^="M12.5 7.08333H7.5"]']),
	("doc_text", ["Knowledge Base"], ['path[d="M12 7v14"]', 'path[d^="M2 3h6a4 4 0 0 1 4 4v14"]', 'path[d^="M16.6667 7.08333H13.75"]']),
	("bag", ["Customers"], ['path[d^="M4.83144 1.7793"]', 'path[d^="M2.5 6.25H17.5"]']),
	("users", ["Contacts"], ['path[d^="M17.915 22a6 6 0 0 0-12 0"]', 'path[d^="M13.3333 16.6667V15.8333"]']),
	("invoice_check", ["Agent Report"], ['path[d^="M7.50583 12.0833H12.5058"]']),
	("docs_album", ["Kanban"], ['path[d^="M5.83333 6.66667H4.58333"]']),
	("phone", ["Call Logs"], []),
]

# Frappe CRM sidebar: href prefix (or #id) -> Figma key
CRM = [
	("analytics", ['a[href^="/crm/dashboard"]']),
	("user", ['a[href^="/crm/leads"]']),
	("dollar", ['a[href^="/crm/deals"]']),
	("users", ['a[href^="/crm/contacts"]']),
	("building", ['a[href^="/crm/organizations"]']),
	("notes", ['a[href^="/crm/notes"]']),
	("checklist", ['a[href^="/crm/tasks"]']),
	("phone", ['a[href^="/crm/call-logs"]']),
	("bell", ['button[aria-label="Notifications"]']),
]

# Website portal sidebar (/orders, /invoices ...): href -> Figma key   (/shipments: needs icon)
PORTAL = {
	"/project": "suitcase", "/projects": "suitcase", "/rfq": "doc_text", "/supplier-quotations": "invoice_text",
	"/purchase-orders": "cart", "/purchase-invoices": "receipt", "/quotations": "invoice_text",
	"/orders": "package", "/invoices": "receipt", "/issues": "headphones", "/addresses": "pin",
	"/timesheets": "clock", "/material-requests": "checklist", "/me": "user", "/newsletters": "mail",
	"/helpdesk/my-tickets": "chat",
}

# Desk launcher tiles (/desk, /apps) - OPT-IN file desk_launcher_icons.css: icon file stem -> Figma key.
# Brand logos (Raven, Helpdesk, CRM, Framework, Frappe HR) and letter tiles (YShop) are left as they are.
LAUNCHER = {
	"invoicing": "invoice_text", "payments": "receipt", "financial_reports": "report", "accounts_setup": "settings",
	"taxes": "percent", "banking": "dollar", "budget": "wallet", "selling": "store", "buying": "cart",
	"manufacturing": "building", "projects": "suitcase", "quality": "verified", "expense_claim": "wallet",
	"hr_setup": "settings", "leaves": "calendar", "salary_payout": "dollar", "performance": "star",
	"recruitment": "users", "shift-attendence": "clock", "tax-benefits": "percent", "employee_lifecycle": "user",
}


def svg_uri(key, color="#000"):
	svg = (ICONS / f"{key}.svg").read_text().strip().replace("currentColor", color)
	svg = re.sub(r"\s+", " ", svg).replace('"', "'")
	return 'url("data:image/svg+xml,' + quote(svg, safe=" '=/:;,.-()") + '")'


def var_block(keys):
	lines = [f"\t--yi-{k}: {svg_uri(k)};" for k in sorted(keys)]
	return ":root {\n" + "\n".join(lines) + "\n}\n"


MASK = (
	'content: "";\n\twidth: 20px;\n\theight: 20px;\n\tbackground: currentColor;\n'
	"\t-webkit-mask: var(--yi) center / 20px 20px no-repeat;\n\tmask: var(--yi) center / 20px 20px no-repeat;\n"
)


def gen_desk():
	groups = {}
	for name, key in DESK.items():
		groups.setdefault(key, []).append(f':has(> svg use[href="#icon-{name}"])')
	slot = ".body-sidebar .sidebar-item-icon"
	out = [var_block(groups)]
	# Generic slot rules driven by custom properties: an unmapped icon keeps --yi-paint transparent and
	# its stock SVG visible, so only mapped icons change (and the selector lists are written once).
	out.append(
		f"{slot}::before {{\n\tcontent: \"\";\n\tposition: absolute;\n\tinset: 0;\n\tmargin: auto;\n"
		"\twidth: 20px;\n\theight: 20px;\n\tpointer-events: none;\n\tbackground: var(--yi-paint, transparent);\n"
		"\t-webkit-mask: var(--yi, none) center / 20px 20px no-repeat;\n\tmask: var(--yi, none) center / 20px 20px no-repeat;\n}\n"
	)
	out.append(f"{slot} > svg {{\n\tvisibility: var(--yi-stock, visible);\n}}\n")
	for key, ms in sorted(groups.items()):
		out.append(
			f"{slot}:is({', '.join(ms)}) {{\n\t--yi: var(--yi-{key});\n\t--yi-paint: currentColor;\n\t--yi-stock: hidden;\n}}\n"
		)
	return "".join(out)


def gen_helpdesk():
	item = '.bg-surface-menu-bar div.cursor-pointer[class*="h-7"]'
	out = [var_block({k for k, _, _ in HELPDESK})]
	all_m = []
	for key, labels, paths in HELPDESK:
		ms = [f'[data-yool-label="{l}"]' for l in labels] + [f":has(> span.shrink-0 svg {p})" for p in paths]
		all_m += ms
		out.append(f"{item}:is({', '.join(ms)}) > span.shrink-0 {{\n\t--yi: var(--yi-{key});\n}}\n")
	union = f"{item}:is({', '.join(all_m)}) > span.shrink-0"
	out.append(f"{union} > svg {{\n\tdisplay: none !important;\n}}\n")
	out.append(f"{union} {{\n\tfont-size: 0 !important;\n}}\n")  # hides emoji icons of Public Views
	out.append(f"{union}::before {{\n\t{MASK}\tposition: absolute;\n\tinset: 0;\n\tmargin: auto;\n}}\n")
	return "".join(out)


def gen_crm():
	item = '.bg-surface-sidebar [data-slot="sidebar-item"]'
	out = [var_block({k for k, _ in CRM})]
	all_m = []
	for key, sels in CRM:
		ms = [f":has(> {s})" for s in sels]
		all_m += ms
		out.append(f"{item}:is({', '.join(ms)}) > :is(a, button) > span:first-child {{\n\t--yi: var(--yi-{key});\n}}\n")
	union = f"{item}:is({', '.join(all_m)}) > :is(a, button) > span:first-child"
	out.append(f"{union} > svg {{\n\tvisibility: hidden !important;\n}}\n")
	out.append(f"{union}::before {{\n\t{MASK}\tposition: absolute;\n\tinset: 0;\n\tmargin: auto;\n}}\n")
	return "".join(out)


def gen_portal():
	a = ".web-sidebar .sidebar-item > a"
	out = [var_block(set(PORTAL.values()))]
	# every link gets a 20px slot (blank when unmapped) so labels stay aligned
	out.append(
		f"{a}::before {{\n\tcontent: \"\";\n\tbackground: var(--yi-paint, transparent);\n"
		"\t-webkit-mask: var(--yi, none) center / 20px 20px no-repeat;\n\tmask: var(--yi, none) center / 20px 20px no-repeat;\n}\n"
	)
	for href, key in PORTAL.items():
		out.append(f'{a}[href="{href}"] {{\n\t--yi: var(--yi-{key});\n\t--yi-paint: currentColor;\n}}\n')
	return "".join(out)


def gen_launcher():
	head = (
		"/*\n * yool_theme / desk_launcher_icons.css  - OPT-IN (not in hooks.py by default).\n"
		" * Replaces the Desk launcher (/desk, /apps) tile images with Figma line icons on a light brand tile.\n"
		" * Enable: add \"/assets/yool_theme/css/desk_launcher_icons.css\" to app_include_css in hooks.py,\n"
		" * then bench build --app yool_theme && bench --site <site> clear-cache. Brand logos are untouched.\n */\n"
	)
	out = [head]
	sel_all = []
	for stem, key in LAUNCHER.items():
		s = f'[class*="desktop-icon"] img[src*="desktop_icons/"][src*="/{stem}.svg"]'
		sel_all.append(s)
		out.append(f"{s} {{\n\tcontent: {svg_uri(key, '#1db487')};\n}}\n")
	out.append(
		f"{', '.join(sel_all)} {{\n\tbox-sizing: border-box;\n\tpadding: 22%;\n\tbackground: #e8f7f1;\n"
		"\tborder: 1px solid #c9eedf;\n\tborder-radius: 22%;\n\tobject-fit: contain;\n}\n"
	)
	return "".join(out)


def splice(path, block):
	text = path.read_text()
	start, end = "/* <yool:icons> generated by tools/build_icons.py - do not edit by hand */", "/* </yool:icons> */"
	i, j = text.index(start), text.index(end)
	path.write_text(text[: i + len(start)] + "\n" + block + text[j:])


def main():
	splice(CSS / "desk_theme.css", gen_desk())
	splice(CSS / "helpdesk_theme.css", gen_helpdesk())
	splice(CSS / "crm_theme.css", gen_crm())
	splice(CSS / "portal_theme.css", gen_portal())
	(CSS / "desk_launcher_icons.css").write_text(gen_launcher())
	print("icon blocks regenerated")
	if "--report" in sys.argv:
		needs = sorted({n for n in SURVEYED if n not in DESK})
		print(f"desk icon names surveyed: {len(set(SURVEYED))}, mapped: {len(set(SURVEYED) & set(DESK))}, needs icon: {len(needs)}")
		print(" ".join(needs))


if __name__ == "__main__":
	main()
