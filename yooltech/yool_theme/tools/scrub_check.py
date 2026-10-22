"""Scrub check for the public repo: run before every commit of yooltech/ (especially after export-fixtures).

    python3 yooltech/yool_theme/tools/scrub_check.py yooltech

Flags: likely secrets (keys/tokens/passwords with a literal value, long hex/base64 strings), phone numbers
(Somali +252/06x/6xxxxxxxx and any other 9+ digit run), e-mail addresses outside the allow-list, and
.docx metadata/parts that can carry personal data. Exit code 1 when anything is found.
"""

import re
import sys
import zipfile
from pathlib import Path

ALLOWED_EMAILS = {"user@example.com", "chatwoot@yool.tech"}
ALLOWED_EMAIL_SUFFIXES = ("@s.whatsapp.net", "@g.us")  # only as format placeholders, e.g. 252XXXXXXXXX@s.whatsapp.net
TEXT_EXT = {".py", ".js", ".json", ".md", ".html", ".css", ".txt", ".toml", ".patch", ".cfg", ".ini", ".yml", ".yaml"}

PATTERNS = [
	("secret literal", re.compile(r"(?i)\b(api_key|api_secret|access_token|api_access_token|password|secret|token)\b\s*[:=]\s*[\"'][^\"'\s]{8,}[\"']")),
	("bearer/gh/sk token", re.compile(r"(?i)(bearer\s+[a-z0-9._-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk_(live|test)_[A-Za-z0-9]{10,})")),
	("long hex", re.compile(r"\b[0-9a-f]{40,}\b")),
	("somali phone", re.compile(r"\+?252[\s-]?\d{7,9}\b|\b0?6\d{8}\b")),
	("9+ digit number", re.compile(r"(?<![\w.#-])\d{9,}(?![\w.])")),
	("email", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
]


def allowed(kind, text, line):
	if kind == "email":
		return text in ALLOWED_EMAILS or text.endswith(ALLOWED_EMAIL_SUFFIXES)
	if kind in ("9+ digit number", "long hex"):
		# SVG path data, CSS numbers and SRI hashes are not personal data
		return "sha512-" in line or "sha384-" in line or "<path" in line or " d=\"" in line or "viewBox" in line
	return False


def scan_text(path, text, hits):
	for no, line in enumerate(text.splitlines(), 1):
		for kind, rx in PATTERNS:
			for m in rx.finditer(line):
				if not allowed(kind, m.group(0), line):
					hits.append(f"{path}:{no}: {kind}: {m.group(0)[:60]}")


def scan_docx(path, hits):
	with zipfile.ZipFile(path) as z:
		for n in z.namelist():
			if n.startswith(("word/ink/", "word/comments", "word/people")):
				hits.append(f"{path}: part {n} (ink/comments/people can hold signatures or names)")
		core = z.read("docProps/core.xml").decode("utf-8", "replace") if "docProps/core.xml" in z.namelist() else ""
		for tag in ("dc:creator", "cp:lastModifiedBy"):
			m = re.search(f"<{tag}>(.*?)</{tag}>", core)
			if m and m.group(1) not in ("", "Yooltech"):
				hits.append(f"{path}: docProps {tag} = {m.group(1)!r}")
		for n in z.namelist():
			if n.startswith("word/") and n.endswith(".xml"):
				scan_text(f"{path}!{n}", re.sub(r"<[^>]+>", " ", z.read(n).decode("utf-8", "replace")), hits)


def main(root):
	hits = []
	for p in sorted(Path(root).rglob("*")):
		if not p.is_file():
			continue
		if p.suffix == ".docx":
			scan_docx(p, hits)
		elif p.suffix in (".csv", ".xlsx", ".pdf") or p.name.startswith(("emr_0", "test_output")):
			hits.append(f"{p}: data file type not allowed in the public repo")
		elif p.suffix in TEXT_EXT:
			scan_text(p, p.read_text(encoding="utf-8", errors="replace"), hits)
	for h in hits:
		print(h)
	print(f"{len(hits)} finding(s)")
	return 1 if hits else 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
