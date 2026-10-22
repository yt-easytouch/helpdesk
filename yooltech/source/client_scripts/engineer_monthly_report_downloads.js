// Client Script: "Engineer Monthly Report Downloads"  (DocType: Engineer Monthly Report, Apply To: Form)
// Adds "Download PDF" and "Download Word" buttons.
(() => {
	const DOCTYPE = "Engineer Monthly Report";
	const PRINT_FORMAT = "Engineer Monthly Report";
	const TEMPLATE_URL = "/private/files/template_engineer_report.docx"; // File URL of template_engineer_report.docx (private file is fine)

	// Pinned CDN builds: docxtemplater from cdnjs, PizZip from jsdelivr (PizZip is not hosted on cdnjs).
	const LIBS = [
		{
			global: "docxtemplater",
			src: "https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.70.1/docxtemplater.min.js",
			integrity: "sha512-DL5RbaJMJM48rqC0JT7HKR4f1Swb4DbmE/C/qn2OFkSKRA16/ZPweKkcSjDRe2smKdo9hedoriYQJg7UwKyYoA==",
		},
		{
			global: "PizZip",
			src: "https://cdn.jsdelivr.net/npm/pizzip@3.3.0/dist/pizzip.min.js",
			integrity: "sha512-MG5zc/E0foqSKdBcSILtA2TemyoC0t22RglllGQRwZq/++6fH3E75bLCJPRLO/+cM09ADSdFQUvN21oJvNNqnQ==",
		},
	];
	const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December"];

	let libs_promise = null;

	function load_script(lib) {
		return new Promise((resolve, reject) => {
			const s = document.createElement("script");
			s.src = lib.src;
			s.integrity = lib.integrity;
			s.crossOrigin = "anonymous";
			s.onload = () => resolve();
			s.onerror = () => reject(new Error("Could not load " + lib.src));
			document.head.appendChild(s);
		});
	}

	// Returns {Docxtemplater, Zip}.
	function load_libs() {
		if (!libs_promise) {
			libs_promise = (async () => {
				for (const lib of LIBS) {
					if (!window[lib.global]) await load_script(lib);
				}
				if (!window.docxtemplater || !window.PizZip) throw new Error("Word libraries failed to initialise");
				return { Docxtemplater: window.docxtemplater, Zip: window.PizZip };
			})().catch((e) => {
				libs_promise = null;
				throw e;
			});
		}
		return libs_promise;
	}

	function ymd(d) {
		// "YYYY-MM-DD[ ...]" -> [y, m, d] numbers, or null
		if (!d) return null;
		const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
		return m ? [+m[1], +m[2], +m[3]] : null;
	}
	const pad = (n) => String(n).padStart(2, "0");
	const d_slash = (d) => { const p = ymd(d); return p ? `${pad(p[2])}/${pad(p[1])}/${p[0]}` : ""; };
	const d_dash = (d) => { const p = ymd(d); return p ? `${pad(p[2])}-${pad(p[1])}-${p[0]}` : ""; };
	const d_dot = (d) => { const p = ymd(d); return p ? `${p[2]}.${p[1]}.${p[0]}` : ""; };
	const s = (v) => (v === null || v === undefined ? "" : String(v));
	const n = (v) => (v === null || v === undefined || v === "" ? 0 : cint(v));
	const money = (v) => { const f = flt(v); return f ? String(+f.toFixed(2)) : ""; };

	function file_base(doc) {
		let base = doc.file_base;
		if (!base) {
			const name = s(doc.engineer_name || doc.engineer).trim();
			if (doc.period_type === "Month" || !doc.period_type) {
				const p = ymd(doc.report_date || doc.to_date || doc.from_date) || ymd(frappe.datetime.get_today());
				base = `${name}_work_report_${MONTHS[p[1] - 1]}_${p[0]}`;
			} else {
				base = `${name}_work_report_${d_dash(doc.from_date)}_${d_dash(doc.to_date)}`;
			}
		}
		return base.replace(/\s+/g, "_").replace(/[\\/:*?"<>|]+/g, "-") || doc.name;
	}

	function save_blob(blob, filename) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.style.display = "none";
		document.body.appendChild(a);
		a.click();
		setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
	}

	async function ensure_saved(frm) {
		if (frm.is_dirty() && frm.doc.docstatus === 0) await frm.save();
	}

	async function download_pdf(frm) {
		await ensure_saved(frm);
		const qs = new URLSearchParams({
			doctype: DOCTYPE, name: frm.doc.name, format: PRINT_FORMAT, no_letterhead: "1",
		});
		const r = await fetch(`/api/method/frappe.utils.print_format.download_pdf?${qs}`, {
			credentials: "same-origin",
			headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
		});
		const ct = r.headers.get("content-type") || "";
		if (!r.ok || !ct.includes("pdf")) {
			const txt = await r.text().catch(() => "");
			throw new Error(`PDF generation failed (HTTP ${r.status}). ${txt.slice(0, 300)}`);
		}
		save_blob(await r.blob(), `${file_base(frm.doc)}.pdf`);
	}

	function word_data(doc) {
		return {
			report_date: d_dot(doc.report_date || doc.to_date),
			engineer_name: s(doc.engineer_name),
			works_done: n(doc.works_done),
			new_clients: n(doc.new_clients),
			issues_resolved: n(doc.issues_resolved),
			clients_visited: n(doc.clients_visited),
			missing_time_count: n(doc.missing_time_count),
			engineer_comment: s(doc.engineer_comment),
			head_comment: s(doc.head_comment),
			activities: (doc.activities || []).map((r, i) => ({
				idx: i + 1,
				activity_date: d_slash(r.activity_date),
				client_name: s(r.client_name),
				issue: s(r.issue),
				solved_by: s(r.solved_by),
				time_spent_text: s(r.time_spent_text),
				activity_status: s(r.activity_status),
				visit_cost: money(r.visit_cost),
			})),
			challenges: (doc.challenges || []).map((r) => ({
				challenge: s(r.challenge), solution: s(r.solution),
			})),
			feedback: (doc.feedback || []).map((r) => ({
				client_name: s(r.client_name), feedback: s(r.feedback),
			})),
		};
	}

	async function download_word(frm) {
		if (TEMPLATE_URL === "TEMPLATE" + "_URL") throw new Error("Word template URL is not configured in this Client Script.");
		await ensure_saved(frm);
		const [{ Docxtemplater, Zip }, buf] = await Promise.all([
			load_libs(),
			fetch(TEMPLATE_URL, { credentials: "same-origin" }).then((r) => {
				if (!r.ok) throw new Error(`Could not fetch Word template (HTTP ${r.status})`);
				return r.arrayBuffer();
			}),
		]);
		const doc = new Docxtemplater(new Zip(buf), {
			paragraphLoop: true,
			linebreaks: true,
			nullGetter: () => "",
		});
		doc.render(word_data(frm.doc));
		const bytes = doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
		const blob = new Blob([bytes], {
			type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});
		save_blob(blob, `${file_base(frm.doc)}.docx`);
	}

	async function run(label, fn, frm) {
		frappe.dom.freeze(__("Preparing {0}...", [label]));
		try {
			await fn(frm);
		} catch (e) {
			console.error(e);
			const msg = (e && e.properties && e.properties.errors)
				? e.properties.errors.map((x) => x.properties && x.properties.explanation).join("<br>")
				: (e && e.message) || String(e);
			frappe.msgprint({ title: __("{0} failed", [label]), message: frappe.utils.escape_html(msg).replace(/&lt;br&gt;/g, "<br>"), indicator: "red" });
		} finally {
			frappe.dom.unfreeze();
		}
	}

	// Expose the downloads so the dashboard Client Script ("Engineer Monthly Report Dashboard")
	// can reuse them without clicking toolbar buttons.
	window.yool_emr = window.yool_emr || {};
	window.yool_emr.download_pdf = (frm) => run(__("PDF"), download_pdf, frm);
	window.yool_emr.download_word = (frm) => run(__("Word"), download_word, frm);

	frappe.ui.form.on(DOCTYPE, {
		refresh(frm) {
			if (frm.is_new()) return;
			frm.add_custom_button(__("Download PDF"), () => run(__("PDF"), download_pdf, frm));
			frm.add_custom_button(__("Download Word"), () => run(__("Word"), download_word, frm));
		},
	});
})();
