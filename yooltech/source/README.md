# source/ (read-only mirror)

Plain-text copies of the code stored inside the fixture records of `yool_theme/yool_theme/fixtures/`, one file
per record, so scripts can be reviewed and diffed. The fixtures are what gets installed; edit the fixture (or
the record on a test site and re-export), then regenerate this folder:

```bash
python3 yooltech/yool_theme/tools/split_fixtures.py
```

| Folder | Fixture file | Field |
|---|---|---|
| `server_scripts/*.py` | `server_script.json` | `script` (runs in Frappe safe_exec) |
| `client_scripts/*.js` | `client_script.json` | `script` |
| `hd_form_scripts/*.js` | `hd_form_script.json` | `script` (Helpdesk HD Form Script) |
| `report/agent_ticket_report.{py,js}` | `report.json` | `report_script`, `javascript` |
| `print_formats/*.{html,css}` | `print_format.json` | `html`, `css` |
