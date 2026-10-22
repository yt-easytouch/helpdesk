"""Install / migrate steps for the Yooltech Helpdesk customizations.

Why this exists (Frappe 16 + Helpdesk 1.26 facts):
- Frappe imports fixtures/*.json in os.listdir() order, so on a fresh site custom fields can be imported
  before the custom DocTypes they belong to (that file is then skipped with "Skipping fixture syncing").
  after_install / after_migrate therefore re-import every fixture file in dependency order.
- Helpdesk ships HD Ticket.raised_outside_working_hours with default "False", which Frappe 16 rejects as soon
  as any Custom Field is added to HD Ticket. before_install / before_migrate create the Property Setter
  (default = 0) before any fixture is imported.
- Data-like records are seeded only when missing, never overwritten (admins own them after install):
  HD Ticket Types, HD Teams "Technical"/"Sales" (no members), the rows of HD Ticket Template "Default",
  the default HD Kanban Settings config, the Word templates/logos and the optional Expense Bill link field.

Every step logs and continues on error: a problem here must never block `bench migrate`.
"""

import json
import os

import frappe

FIXTURE_ORDER = [
	"module_def",
	"doctype",
	"property_setter",
	"custom_field",
	"server_script",
	"client_script",
	"hd_form_script",
	"print_format",
	"report",
	"hd_view",
]


def before_install():
	ensure_prerequisites()


def before_migrate():
	ensure_prerequisites()


def after_install():
	sync_fixtures_in_order()
	seed_records()


def after_migrate():
	sync_fixtures_in_order()
	seed_records()


def _log(title, exc=None):
	try:
		frappe.log_error(title=f"yool_theme: {title}", message=frappe.get_traceback() if exc else title)
	except Exception:
		pass
	print(f"yool_theme: {title}")


def ensure_prerequisites():
	if not frappe.db.exists("DocType", "HD Ticket"):
		return
	try:
		if not frappe.db.exists("Property Setter", "HD Ticket-raised_outside_working_hours-default"):
			frappe.make_property_setter(
				{
					"doctype": "HD Ticket",
					"fieldname": "raised_outside_working_hours",
					"property": "default",
					"value": "0",
					"property_type": "Text",
				},
				validate_fields_for_doctype=False,
				is_system_generated=False,
			)
		if not frappe.db.exists("Module Def", "Yool Chatwoot"):
			frappe.get_doc(
				{"doctype": "Module Def", "module_name": "Yool Chatwoot", "app_name": "helpdesk", "custom": 1}
			).insert(ignore_permissions=True)
		frappe.db.commit()
	except Exception as e:
		_log("ensure_prerequisites failed", e)


def sync_fixtures_in_order():
	from frappe.core.doctype.data_import.data_import import import_doc

	frappe.flags.in_fixtures = True
	try:
		for name in FIXTURE_ORDER:
			path = frappe.get_app_path("yool_theme", "fixtures", name + ".json")
			if not os.path.exists(path):
				continue
			try:
				import_doc(path)
				frappe.db.commit()
			except Exception as e:
				frappe.db.rollback()
				_log(f"fixture {name}.json not imported", e)
	finally:
		frappe.flags.in_fixtures = False


def _seed_data():
	with open(frappe.get_app_path("yool_theme", "seed", "records.json"), encoding="utf-8") as f:
		return json.load(f)


def seed_records():
	try:
		data = _seed_data()
	except Exception as e:
		_log("seed/records.json unreadable", e)
		return
	for step in (_seed_ticket_types, _seed_teams, _seed_template_fields, _seed_kanban, _seed_files, _seed_optional_fields):
		try:
			step(data)
			frappe.db.commit()
		except Exception as e:
			frappe.db.rollback()
			_log(f"{step.__name__} failed", e)


def _insert_missing(doc):
	if frappe.db.exists(doc["doctype"], doc["name"]):
		return False
	frappe.get_doc(dict(doc)).insert(ignore_permissions=True, set_name=doc["name"])
	return True


def _seed_ticket_types(data):
	for d in data.get("hd_ticket_type", []):
		_insert_missing(d)


def _seed_teams(data):
	# Members are NOT shipped (staff emails): add them in Helpdesk -> Settings -> Teams after install.
	for d in data.get("hd_team", []):
		d = dict(d)
		d["users"] = []
		_insert_missing(d)


def _seed_template_fields(data):
	rows = data.get("hd_ticket_template_default_fields", [])
	if not rows:
		return
	if frappe.db.exists("HD Ticket Template", "Default"):
		tpl = frappe.get_doc("HD Ticket Template", "Default")
	else:
		tpl = frappe.get_doc({"doctype": "HD Ticket Template", "template_name": "Default"})
	have = {r.fieldname for r in tpl.get("fields", [])}
	changed = tpl.is_new()
	for r in rows:
		if r["fieldname"] in have:
			continue
		if not frappe.db.exists("Custom Field", {"dt": "HD Ticket", "fieldname": r["fieldname"]}) and not frappe.db.exists(
			"DocField", {"parent": "HD Ticket", "fieldname": r["fieldname"]}
		):
			continue
		tpl.append("fields", r)
		changed = True
	if not changed:
		return
	if tpl.is_new():
		tpl.insert(ignore_permissions=True)
	else:
		tpl.save(ignore_permissions=True)


def _seed_kanban(data):
	cfg = data.get("hd_kanban_settings_default_config")
	if not cfg or not frappe.db.exists("DocType", "HD Kanban Settings"):
		return
	if not frappe.db.get_single_value("HD Kanban Settings", "config"):
		frappe.db.set_single_value("HD Kanban Settings", "config", cfg)


def _seed_files(data):
	for f in data.get("files", []):
		if frappe.db.exists("File", {"file_url": f["file_url"]}):
			continue
		src = frappe.get_app_path("yool_theme", *f["src"].split("/"))
		with open(src, "rb") as fh:
			content = fh.read()
		doc = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f["file_url"].rsplit("/", 1)[-1],
				"is_private": f["is_private"],
				"content": content,
			}
		).insert(ignore_permissions=True)
		if doc.file_url != f["file_url"]:
			_log(f"{f['file_url']} was saved as {doc.file_url}; rename it so the scripts find it")


def _seed_optional_fields(data):
	# Site-specific links (e.g. Expense Bill from the EasyCustomize app): only when that DocType exists.
	for d in data.get("optional_custom_fields", []):
		if frappe.db.exists("DocType", d["dt"]) and not frappe.db.exists("Custom Field", d["name"]):
			frappe.get_doc(dict(d, doctype="Custom Field")).insert(ignore_permissions=True)
