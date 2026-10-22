app_name = "yool_theme"
app_title = "Yool Theme"
app_publisher = "Yooltech"
app_description = "Figma (UI-dinsg, Side Menu 10450:5374) theme for Desk, Helpdesk, CRM and portal sidebars"
app_email = "user@example.com"
app_license = "mit"

# Desk (/app, /desk): workspace sidebar theme + Figma icons (pure CSS); the JS only loads the font.
app_include_css = ["/assets/yool_theme/css/desk_theme.css"]
app_include_js = ["/assets/yool_theme/js/desk_theme.js"]
# Optional Desk launcher tiles (/desk, /apps) with Figma icons - see README "Optional":
# app_include_css = ["/assets/yool_theme/css/desk_theme.css", "/assets/yool_theme/css/desk_launcher_icons.css"]

# Website / portal pages (/orders, /invoices, /issues, /me ...): portal sidebar only.
web_include_css = ["/assets/yool_theme/css/portal_theme.css"]

# Helpdesk (/helpdesk/*) and CRM (/crm/*) are standalone Vue pages that ignore the include hooks above.
# This hook adds our <link>/<script> tags to those HTML responses (no Helpdesk/CRM file is edited).
after_request = ["yool_theme.theme_inject.inject_spa_assets"]


# ---------------------------------------------------------------------------------------------------------
# Yooltech Helpdesk customizations (see ../../docs/README.md).
# Records live in yool_theme/fixtures/*.json and are (re)imported by `bench migrate`. Only the names below
# are ours: `bench --site <site> export-fixtures --app yool_theme` exports exactly these and nothing else.
# After an export from a live site ALWAYS run `python3 tools/scrub_check.py` before committing (public repo).
# Data-like records (ticket types, teams, ticket-template rows, Kanban defaults, Word templates) are NOT
# fixtures: install.py inserts them only when missing, so admin changes survive every migrate.
# ---------------------------------------------------------------------------------------------------------
required_apps = ["helpdesk"]

before_install = "yool_theme.install.before_install"
after_install = "yool_theme.install.after_install"
before_migrate = "yool_theme.install.before_migrate"
after_migrate = "yool_theme.install.after_migrate"

fixtures = [
	{
		"dt": "Module Def",
		"filters": [["name", "in", [
			"Yool Chatwoot",
		]]],
	},
	{
		"dt": "DocType",
		"filters": [["name", "in", [
			"Chatwoot Agent Map",
			"Chatwoot Status Message",
			"Chatwoot Settings",
			"Chatwoot Sync Log",
			"Engineer Report Activity",
			"Engineer Report Challenge",
			"Engineer Report Feedback",
			"Engineer Monthly Report",
			"HD Kanban Settings",
			"HD Ticket Type Item",
			"Team Report Challenge",
			"Team Report Customer",
			"Team Report EMR Link",
			"Team Report Engineer",
			"Team Report Feedback",
			"Team Report Issue Type",
			"Team Monthly Report",
		]]],
	},
	{
		"dt": "Property Setter",
		"filters": [["name", "in", [
			"HD Ticket-raised_outside_working_hours-default",
		]]],
	},
	{
		"dt": "Custom Field",
		"filters": [["name", "in", [
			"Chatwoot Settings-agent_message_template",
			"Chatwoot Settings-bridge_user",
			"Chatwoot Settings-customer_message_template",
			"Chatwoot Settings-internal_key",
			"Chatwoot Settings-max_messages_per_minute",
			"Chatwoot Settings-notify_agents",
			"Chatwoot Settings-sales_alert_inbox_id",
			"Chatwoot Settings-sales_alert_sales_phone",
			"Chatwoot Settings-sales_alert_tech_phone",
			"Chatwoot Settings-status_messages",
			"Chatwoot Settings-test_numbers",
			"Chatwoot Settings-welcome_message_template",
			"Chatwoot Settings-whatsapp_paused",
			"HD Ticket-caller_name",
			"HD Ticket-caller_phone",
			"HD Ticket-caller_role",
			"HD Ticket-chatwoot_column_break",
			"HD Ticket-chatwoot_contact_id",
			"HD Ticket-chatwoot_conversation_id",
			"HD Ticket-chatwoot_inbox",
			"HD Ticket-chatwoot_opted_out",
			"HD Ticket-chatwoot_reply_conversation",
			"HD Ticket-chatwoot_section",
			"HD Ticket-chatwoot_welcome_sent",
			"HD Ticket-erp_customer",
			"HD Ticket-erp_customer_name",
			"HD Ticket-primary_contact_name",
			"HD Ticket-solved_by",
			"HD Ticket-source",
			"HD Ticket-source_team",
			"HD Ticket-ticket_types",
			"HD Ticket-time_spent",
		]]],
	},
	{
		"dt": "Server Script",
		"filters": [["name", "in", [
			"Chatwoot API",
			"Chatwoot Inbound",
			"Chatwoot Message Templates",
			"Chatwoot Poll",
			"Chatwoot Settings Team Numbers",
			"Chatwoot Webhook",
			"Chatwoot Webhook Old URL",
			"Engineer Monthly Report Permission",
			"Engineer Monthly Report Validate",
			"HD Ticket Assigned Requires Engineer",
			"HD Ticket Caller Validation",
			"HD Ticket Chatwoot Link",
			"HD Ticket Chatwoot Sync",
			"HD Ticket Sales Alert",
			"HD Ticket Source Team",
			"HD Ticket Time Spent",
			"HD Ticket Type Required",
			"Team Monthly Report Validate",
			"ToDo Chatwoot Agent Notify",
			"Yool Caller Defaults",
			"Yool Engineer Report Generate",
			"Yool Engineer Report Generate All",
			"Yool Engineer Report Refresh",
			"Yool Team Report Generate",
			"Yool Team Report Refresh",
			"Yool Ticket Preview",
		]]],
	},
	{
		"dt": "Client Script",
		"filters": [["name", "in", [
			"Chatwoot Settings - Buttons",
			"Chatwoot Sync Log - Retry",
			"Engineer Monthly Report Dashboard",
			"Engineer Monthly Report Downloads",
			"Engineer Monthly Report Form",
			"Team Monthly Report Dashboard",
			"Team Monthly Report Downloads",
			"Team Monthly Report Form",
		]]],
	},
	{
		"dt": "HD Form Script",
		"filters": [["name", "in", [
			"Agent Report Sidebar Button",
			"Caller Autofill",
			"Helpdesk Figma Theme",
			"Helpdesk Figma Theme Ticket",
			"Ticket Kanban",
		]]],
	},
	{
		"dt": "Print Format",
		"filters": [["name", "in", [
			"Engineer Monthly Report",
			"Team Monthly Report",
		]]],
	},
	{
		"dt": "Report",
		"filters": [["name", "in", [
			"Agent Ticket Report",
		]]],
	},
	{
		"dt": "HD View",
		"filters": [["name", "in", [
			"VIEW-HD Ticket-1237",
			"VIEW-HD Ticket-1239",
		]]],
	},
]
