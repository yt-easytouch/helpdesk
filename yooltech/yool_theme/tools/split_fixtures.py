"""Regenerate yooltech/source/ (read-only script mirror) from yool_theme/fixtures/*.json.

    python3 yooltech/yool_theme/tools/split_fixtures.py
"""

import json
import re
import shutil
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
FIX = APP / "yool_theme" / "fixtures"
SRC = APP.parent / "source"


def slug(s):
	return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def load(name):
	return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def write(path, text):
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(text or "", encoding="utf-8")


def main():
	for sub in ("server_scripts", "client_scripts", "hd_form_scripts", "report", "print_formats"):
		shutil.rmtree(SRC / sub, ignore_errors=True)
	for fixture, sub, ext in (
		("server_script", "server_scripts", "py"),
		("client_script", "client_scripts", "js"),
		("hd_form_script", "hd_form_scripts", "js"),
	):
		for d in load(fixture):
			write(SRC / sub / f"{slug(d['name'])}.{ext}", d.get("script"))
	for d in load("report"):
		write(SRC / "report" / f"{slug(d['name'])}.py", d.get("report_script"))
		write(SRC / "report" / f"{slug(d['name'])}.js", d.get("javascript"))
	for d in load("print_format"):
		write(SRC / "print_formats" / f"{slug(d['name'])}.html", d.get("html"))
		if d.get("css"):
			write(SRC / "print_formats" / f"{slug(d['name'])}.css", d["css"])


if __name__ == "__main__":
	main()
