// Client Script: "Team Monthly Report Downloads"  (DocType: Team Monthly Report, Apply To: Form)
// Adds "Download PDF" and "Download Word" buttons; exposes window.yool_tmr for the dashboard UI.
(() => {
	const DOCTYPE = "Team Monthly Report";
	const PRINT_FORMAT = "Team Monthly Report";
	const TEMPLATE_URL = "/private/files/template_team_report.docx"; // set to the File URL of template_team_report.docx (private file is fine)

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
		if (!d) return null;
		const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
		return m ? [+m[1], +m[2], +m[3]] : null;
	}
	const s = (v) => (v === null || v === undefined ? "" : String(v));
	const n = (v) => (v === null || v === undefined || v === "" ? 0 : cint(v));
	const money = (v) => "$" + flt(v || 0).toFixed(2);

	// hordhac is a Text Editor field: flatten its HTML to plain text with paragraph breaks.
	function html_to_text(html) {
		if (!html) return "";
		const doc = new DOMParser().parseFromString(
			String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n"),
			"text/html");
		return (doc.body.textContent || "").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
	}

	function file_base(doc) {
		let base = doc.file_base;
		if (!base) {
			const p = ymd(doc.to_date || doc.from_date) || ymd(frappe.datetime.get_today());
			base = (doc.month_label
				? `XAFIISKA_FARSAMADA_${doc.month_label}_REPORT`
				: `XAFIISKA_FARSAMADA_${MONTHS[p[1] - 1]}_${p[0]}_REPORT`);
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
		// Revoke very late: this Chrome profile has "Ask where to save each file" enabled,
		// and the blob URL must stay alive until the user answers the native Save dialog
		// (a 2s revoke cancelled the download: USER_CANCELED, discarded .com.google.Chrome temp).
		setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600000);
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
		const engineers = doc.engineer_rows || [];
		const top = engineers.reduce((a, r) => (!a || cint(r.ticket_count) > cint(a.ticket_count) ? r : a), null);
		let no = 0;
		return {
			month_label: s(doc.month_label),
			hordhac: html_to_text(doc.hordhac),
			nuxur_cilado: s(doc.nuxur_cilado),
			nuxur_macaamiil: s(doc.nuxur_macaamiil),
			nuxur_injineer: s(doc.nuxur_injineer),
			nuxur_kharash: s(doc.nuxur_kharash),
			fariin_count: n(doc.fariin_count),
			wicitaan_count: n(doc.wicitaan_count),
			booqasho_count: n(doc.booqasho_count),
			new_clients_count: n(doc.new_clients_count),
			issues_resolved_count: n(doc.issues_resolved_count),
			clients_visited_count: n(doc.clients_visited_count),
			total_issues: n(doc.total_issues),
			resolved_count: n(doc.resolved_count),
			unresolved_count: n(doc.unresolved_count),
			customers_served: (doc.customer_rows || []).length,
			total_expense: money(doc.total_expense),
			avg_expense: money(doc.avg_expense_per_issue),
			total_overtime: engineers.reduce((t, r) => t + n(r.overtime_count), 0),
			total_online: engineers.reduce((t, r) => t + n(r.online_count), 0),
			top_engineer_name: s(top && top.engineer_name),
			top_engineer_pct: s(top && top.pct),
			prepared_by_name: s(doc.prepared_by_name),
			issue_rows: (doc.issue_rows || []).map((r) => ({
				idx: r.issue_type === "Lama xirin ticket" ? "" : String(++no),
				issue_type: s(r.issue_type),
				ticket_count: n(r.ticket_count),
				pct: s(r.pct),
				expense: money(r.expense),
			})),
			customer_rows: (doc.customer_rows || []).map((r, i) => ({
				idx: i + 1,
				customer_name: s(r.customer_name || r.customer),
				ticket_count: n(r.ticket_count),
				ticket_pct: s(r.ticket_pct),
				expense: money(r.expense),
				expense_pct: s(r.expense_pct),
			})),
			engineer_rows: engineers.map((r) => ({
				engineer_name: s(r.engineer_name),
				ticket_count: n(r.ticket_count),
				overtime_count: n(r.overtime_count),
				online_count: n(r.online_count),
				pct: s(r.pct),
			})),
			challenges: (doc.challenges || []).map((r) => ({
				challenge: s(r.challenge), solution: s(r.solution),
			})),
			feedback_rows: (doc.feedback_rows || []).map((r) => ({
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

	// Expose the downloads so the dashboard Client Script ("Team Monthly Report Dashboard")
	// can call them without clicking toolbar buttons.
	window.yool_tmr = window.yool_tmr || {};
	window.yool_tmr.download_pdf = (frm) => run(__("PDF"), download_pdf, frm);
	window.yool_tmr.download_word = (frm) => run(__("Word"), download_word, frm);

	frappe.ui.form.on(DOCTYPE, {
		refresh(frm) {
			if (frm.is_new()) return;
			frm.add_custom_button(__("Download PDF"), () => run(__("PDF"), download_pdf, frm));
			frm.add_custom_button(__("Download Word"), () => run(__("Word"), download_word, frm));
		},
	});
})();
