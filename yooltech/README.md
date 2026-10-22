# yooltech/

Yooltech's customizations of this Helpdesk (my.yool.tech), kept apart from the upstream Helpdesk code.

- `yool_theme/` — installable Frappe app: Figma theme + every Yooltech DocType, custom field, script, view,
  report and print format as fixtures.
- `docs/README.md` — features, install / upgrade / rollback, configuration, what is not included.
- `docs/SOMALI.md` — soo koobid Soomaali ah.
- `source/` — read-only mirror of the scripts for review (generated from the fixtures).

No secrets, phone numbers, staff e-mails or customer data belong here. Run
`python3 yooltech/yool_theme/tools/scrub_check.py yooltech` before every commit.
