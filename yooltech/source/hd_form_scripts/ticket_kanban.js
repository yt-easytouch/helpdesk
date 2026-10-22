// HD Form Script — "Ticket Kanban" (dt: HD Ticket, apply_to: Form, apply_on_new_page: 1, agents only).
//
// A public HD View "Kanban" (VIEW-HD Ticket-1239) points at the new-ticket page, so
// Helpdesk lists it under "List ˅ → Public Views" and in the sidebar. When that page is
// opened through the view, this script draws a Kanban board over the content area:
// one column per HD Ticket Status, cards with drag & drop to change the status.
//
// - Status changes use frappe.client.set_value (a normal HD Ticket save), so SLA,
//   notifications and the activity log behave as in the ticket view.
// - Column labels / colors / hidden columns / default order are display-only settings for
//   everyone, stored in the Single doctype "HD Kanban Settings" (field "config", JSON). Only
//   Agent Manager / System Manager can write it (doctype permissions); agents only read it.
// - Each user's own layout (collapsed columns + column order) is stored in Frappe User
//   Settings for "HD Ticket" under the key "yool_kanban" (per user, server-side).
// - All ticket text is inserted with textContent (never as HTML).
// - Sales/Technical intake: HD Ticket.source_team ("Ka yimid"). New-ticket "Team" picker (default = the user's HD Team
//   Sales/Technical), "Sales" card badge, preview "Ka yimid" line, Who → Team filter. Sales tickets WhatsApp the
//   Technical team (Server Script "HD Ticket Sales Alert"; the form passes its Assign-to pick as yool_assign_to).
// - Sales lane (2026-10-22): HD Ticket Status "Sales" (category Open) = column SALES, shown before CUSUB
//   (HD Kanban Settings config). New Sales tickets start there ("HD Ticket Source Team"); Technical drags them on to
//   Assigned / In Progress. Entering Sales sends no customer WhatsApp ("HD Ticket Chatwoot Sync").
//   Managers: "⚙ Team numbers / Numbarrada kooxaha" (column ⋮ menu and the WhatsApp switch menu) edits the
//   Sales-alert numbers in Chatwoot Settings through chatwoot_message_templates action=team_numbers, plus
//   "Inbox-ka Sales (Chatwoot)" = sales_alert_inbox_id, the Chatwoot inbox (WhatsApp number) the alert is sent FROM.
// - Sales defaults (2026-10-22): a member of HD Team "Sales" who is not in "Technical" gets the new-ticket form with
//   Team = Sales and Column = SALES, both locked. Everyone else: picking Team Sales moves Column to SALES, picking
//   another team moves it back to CUSUB. Test hooks (no save): __yoolKanban.newTicketDefaults(user),
//   __yoolKanban.openNewTicket(null, { asUser: user }) shows that user's defaults with Create disabled.
// - Card "⋮" menu / Space opens a Preview panel on the right (?preview=<ticket> in the URL), fed by the API
//   server script "yool_ticket_preview"; status / priority / assignment changes there update the card.
// No Helpdesk files are changed. Customers never get this view (agent route only).
function setupForm({ router }) {
	const VIEW = "VIEW-HD Ticket-1239";
	const ROOT_ID = "yool-ticket-kanban";
	const SETTINGS = "HD Kanban Settings";
	const PAGE = 20;
	const OLD_CLOSED_DAYS = 30;
	const COLORS = {
		Gray: "#8D99A6",
		Blue: "#2490EF",
		Green: "#29CD42",
		Amber: "#ECAD4B",
		Yellow: "#ECAD4B",
		Orange: "#F8814F",
		Red: "#E24C4C",
		Purple: "#9C45E3",
		Teal: "#16A8A8",
		Pink: "#ED6396",
		Black: "#525252",
	};
	const state = window.__yoolKanban || (window.__yoolKanban = {});

	const isRoute = () =>
		/\/helpdesk\/tickets\/new\/?$/.test(window.location.pathname) &&
		new URLSearchParams(window.location.search).get("view") === VIEW;

	// ---------- server helpers ----------
	const serverMessage = (j) => {
		let msg = "";
		try {
			msg = JSON.parse(JSON.parse(j._server_messages)[0]).message;
		} catch (e) {
			msg = j.exception || j.message || "";
		}
		// DOMParser documents are inert (no scripts, no image loads): only used to strip tags.
		return (new DOMParser().parseFromString(String(msg), "text/html").body.textContent || "").trim();
	};
	const api = async (method, params, post) => {
		const opts = { headers: { Accept: "application/json" } };
		let url = "/api/method/" + method;
		if (post) {
			opts.method = "POST";
			opts.headers["Content-Type"] = "application/json";
			opts.headers["X-Frappe-CSRF-Token"] = window.csrf_token;
			opts.body = JSON.stringify(params || {});
		} else if (params) {
			const q = new URLSearchParams();
			Object.keys(params).forEach((k) => {
				const v = params[k];
				q.set(k, typeof v === "string" ? v : JSON.stringify(v));
			});
			url += "?" + q.toString();
		}
		const r = await fetch(url, opts);
		const j = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(serverMessage(j) || r.statusText);
		return j.message;
	};
	const getList = (doctype, fields, filters, extra) =>
		api("frappe.client.get_list", Object.assign({ doctype, fields, filters, limit_page_length: 500 }, extra || {}));

	// ---------- small DOM helpers ----------
	const el = (tag, style, text) => {
		const e = document.createElement(tag);
		if (style) e.style.cssText = style;
		if (text != null) e.textContent = text;
		return e;
	};
	const toast = (text, ok) => {
		const t = el(
			"div",
			"position:fixed;right:20px;bottom:20px;z-index:9999;max-width:420px;padding:10px 14px;border-radius:8px;font-size:13px;" +
				"box-shadow:0 4px 16px rgba(0,0,0,.25);color:#fff;background:" +
				(ok ? "#2f9e44" : "#d9480f"),
			text
		);
		document.body.appendChild(t);
		setTimeout(() => t.remove(), 6000);
	};
	const findMain = () => {
		const row = document.querySelector("#app .h-screen");
		return row ? [...row.children].find((c) => c.classList.contains("flex-1")) : null;
	};
	const escapeLike = (s) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
	const daysAgo = (n) => {
		const d = new Date(Date.now() - n * 86400000);
		return d.toISOString().slice(0, 10);
	};

	// ---------- board ----------
	const buildBoard = async () => {
		const main = findMain();
		if (!main || document.getElementById(ROOT_ID)) return;

		const root = el(
			"div",
			"position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;background:var(--surface-white,#fff);" +
				"color:var(--ink-gray-9,#111);font-size:13px;"
		);
		root.id = ROOT_ID;
		state.mainOverflow = main.style.overflow;
		state.mainBackground = main.style.background;
		main.scrollTop = 0;
		main.style.overflow = "hidden";
		main.appendChild(root);

		// ---------- header (Figma "UI-dinsg": Header navigation, Input dropdown, Toggle, Pill) ----------
		// Figma has light tokens only; in Helpdesk dark mode the same roles use Helpdesk's own surfaces.
		const dark = document.documentElement.getAttribute("data-theme") === "dark";
		const T = {
			font: '"Manrope", var(--font-stack, system-ui), sans-serif',
			surface: dark ? "var(--surface-white, #0f0f0f)" : "#ffffff", // bg-white-primary (F-900)
			subtle: dark ? "var(--surface-gray-1, #232323)" : "#fafafa", // bg-gray-tertiary (25)
			divider: dark ? "var(--outline-gray-2, #343434)" : "#f0f0f1", // border-gray-tertiary (50)
			navBorder: dark ? "var(--outline-gray-1, #232323)" : "rgba(7, 10, 14, 0.05)", // alpha base-gray-5%
			border: dark ? "var(--outline-gray-2, #343434)" : "#dadadb", // border-gray-secondary (100)
			text900: dark ? "var(--ink-gray-9, #f8f8f8)" : "#070a0e", // text-gray-primary (900)
			text500: dark ? "var(--ink-gray-7, #afafaf)" : "#4a4c4f", // text-gray-secondary (500)
			text300: dark ? "var(--ink-gray-5, #808080)" : "#8f9193", // text-gray-tertiary (300)
			brand: "#1db487", // bg-brand-bold (600)
			brandSoftBg: dark ? "rgba(29, 180, 135, 0.16)" : "#e9fbf6", // bg-brand-primary (50)
			brandSoftText: dark ? "#6ee8c3" : "#1aa37a", // text-brand-secondary (700)
			toggleOff: dark ? "var(--surface-gray-3, #343434)" : "#dadadb", // bg-gray-secondary (100)
		};
		if (!document.getElementById("yool-manrope")) {
			const font = document.createElement("link");
			font.id = "yool-manrope";
			font.rel = "stylesheet";
			font.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap";
			document.head.appendChild(font);
		}

		// Section 1: Header navigation — title on the left, actions on the right.
		const header = el(
			"div",
			"display:flex;align-items:center;gap:16px;padding:16px 24px;background:" + T.surface + ";border-bottom:1px solid " + T.navBorder + ";font-family:" + T.font + ";"
		);
		const titleBox = el("div", "display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;");
		const crumbs = el("div", "display:flex;align-items:center;gap:6px;font:500 14px/20px " + T.font + ";color:" + T.text300 + ";");
		const back = el("a", "color:" + T.text500 + ";cursor:pointer;text-decoration:none;", "Tickets");
		back.addEventListener("click", () => router.push({ name: "TicketsAgent" }));
		crumbs.append(back, el("span", null, "/"), el("span", "color:" + T.text900 + ";", "Kanban"));
		const titleRow = el("div", "display:flex;align-items:center;gap:10px;");
		const totalPill = el(
			"span",
			"display:inline-flex;align-items:center;padding:0 8px;border-radius:120px;font:500 14px/20px " + T.font + ";background:" + T.brandSoftBg + ";color:" + T.brandSoftText + ";",
			"…"
		);
		titleRow.append(el("span", "font:600 20px/28px " + T.font + ";color:" + T.text900 + ";", "Ticket board"), totalPill);
		titleBox.append(crumbs, titleRow);

		const textBtnStyle =
			"display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;background:none;cursor:pointer;" +
			"font:500 14px/20px " + T.font + ";color:" + T.text500 + ";";
		const refreshBtn = el("button", textBtnStyle, "↻  Refresh");
		const expandBtn = el("button", textBtnStyle, "⇥  Expand all");
		[refreshBtn, expandBtn].forEach((b) => {
			b.addEventListener("mouseenter", () => (b.style.background = T.subtle));
			b.addEventListener("mouseleave", () => (b.style.background = "none"));
		});
		const listBtn = el("button", textBtnStyle, "☰  List view");
		listBtn.addEventListener("mouseenter", () => (listBtn.style.background = T.subtle));
		listBtn.addEventListener("mouseleave", () => (listBtn.style.background = "none"));
		const newBtn = el(
			"button",
			"display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:0;border-radius:8px;cursor:pointer;" +
				"font:500 14px/20px " + T.font + ";color:#ffffff;background:" + T.brand + ";box-shadow:0 1px 2px rgba(16,24,40,0.05);",
			"＋  New ticket"
		);
		newBtn.type = "button";
		newBtn.addEventListener("mouseenter", () => (newBtn.style.background = "#1aa37a"));
		newBtn.addEventListener("mouseleave", () => (newBtn.style.background = T.brand));
		newBtn.addEventListener("click", () => openNewTicket());
		listBtn.addEventListener("click", () => router.push({ name: "TicketsAgent" }));
		const actions = el("div", "display:flex;align-items:center;gap:8px;flex:0 0 auto;");
		actions.append(expandBtn, refreshBtn, listBtn, el("span", "width:1px;height:24px;background:" + T.divider + ";margin:0 4px;"), newBtn);
		header.append(titleBox, actions);

		// Section 2: filters, grouped (Who / What / When / Options) with labels above inputs.
		const bar = el(
			"div",
			"display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px 0;padding:12px 24px 16px;background:" + T.subtle + ";" +
				"border-bottom:1px solid " + T.divider + ";font-family:" + T.font + ";"
		);
		const inputStyle =
			"height:40px;box-sizing:border-box;padding:8px 12px;border:1px solid " + T.border + ";border-radius:8px;background:" + T.surface + ";" +
			"color:" + T.text900 + ";font:500 14px/20px " + T.font + ";outline:none;";
		const focusRing = (input) => {
			input.addEventListener("focus", () => {
				input.style.borderColor = "#6ee8c3"; // functional-teal-green (300)
				input.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06), 0 0 0 4px rgba(29,180,135,0.2)";
			});
			input.addEventListener("blur", () => {
				input.style.borderColor = T.border;
				input.style.boxShadow = "";
			});
			return input;
		};

		// Figma "Input dropdown" + "Dropdown menu list item": our own popups instead of the browser's native select/date UI.
		const SVG = {
			chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
			calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
			check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
			left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
			right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
		};
		const hoverBg = dark ? "var(--surface-gray-2, #2a2a2a)" : "#f0f0f1"; // bg-gray-secondary-hover-alike (50)
		const openBorder = "#20c997"; // border-brand-primary (500)
		let openPop = null;
		const closePop = () => {
			if (!openPop) return;
			openPop.panel.remove();
			openPop.trigger.setOpen(false);
			openPop = null;
		};
		const popPanel = () => {
			const p = el(
				"div",
				"position:fixed;z-index:1000;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;padding:8px;border-radius:8px;" +
					"border:1px solid " + T.divider + ";background:" + T.surface + ";box-shadow:0 8px 32px -2px rgba(16,24,32,0.08);font-family:" + T.font + ";"
			);
			p.dataset.yoolPop = "1";
			return p;
		};
		const placePop = (trigger, panel) => {
			const r = trigger.getBoundingClientRect();
			panel.style.left = r.left + "px";
			panel.style.top = r.bottom + 8 + "px";
			const pr = panel.getBoundingClientRect();
			if (pr.right > innerWidth - 8) panel.style.left = Math.max(8, innerWidth - 8 - pr.width) + "px";
			if (pr.bottom > innerHeight - 8) panel.style.top = Math.max(8, r.top - 8 - pr.height) + "px";
		};
		const openPopover = (trigger, panel) => {
			closePop();
			panel.style.minWidth = trigger.getBoundingClientRect().width + "px";
			document.body.append(panel);
			placePop(trigger, panel);
			trigger.setOpen(true);
			openPop = { trigger, panel };
		};
		document.addEventListener(
			"mousedown",
			(e) => {
				if (openPop && !openPop.panel.contains(e.target) && !openPop.trigger.contains(e.target)) closePop();
			},
			true
		);
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") closePop();
		});
		window.addEventListener("resize", closePop);

		const trigger = (icon) => {
			const b = el("button", inputStyle + "display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left;");
			b.type = "button";
			const lab = el("span", "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;");
			const ico = el("span", "display:flex;flex:0 0 auto;color:" + T.text300 + ";transition:transform 150ms;");
			ico.innerHTML = icon;
			b.append(lab, ico);
			b.setText = (text, muted) => {
				lab.textContent = text;
				lab.style.color = muted ? T.text300 : T.text900;
			};
			b.setOpen = (on) => {
				b.style.borderColor = on ? openBorder : T.border;
				if (icon === SVG.chevron) ico.style.transform = on ? "rotate(180deg)" : "";
			};
			b.addEventListener("mouseenter", () => openPop?.trigger !== b && (b.style.borderColor = T.text300));
			b.addEventListener("mouseleave", () => openPop?.trigger !== b && (b.style.borderColor = T.border));
			return b;
		};
		const menuRow = (lead, label, selected) => {
			const row = el(
				"div",
				"display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;" +
					"font:" + (selected ? 500 : 400) + " 16px/24px " + T.font + ";color:" + (selected ? T.text900 : T.text500) + ";"
			);
			if (lead) row.append(lead);
			row.append(el("span", "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;", label));
			if (selected) {
				const c = el("span", "display:flex;flex:0 0 auto;color:" + T.text900 + ";");
				c.innerHTML = SVG.check;
				row.append(c);
			}
			row.addEventListener("mouseenter", () => {
				row.style.background = hoverBg;
				row.style.color = T.text900;
			});
			row.addEventListener("mouseleave", () => {
				row.style.background = "";
				row.style.color = selected ? T.text900 : T.text500;
			});
			return row;
		};
		// items: [{ value, label, lead?: () => Element }]
		const dropdown = (allLabel) => {
			const b = trigger(SVG.chevron);
			let items = [];
			let value = "";
			const paint = () => {
				const it = items.find((i) => i.value === value);
				b.setText(it ? it.label : allLabel, !it);
			};
			Object.defineProperty(b, "value", {
				get: () => value,
				set: (v) => {
					value = v || "";
					paint();
				},
			});
			b.setOptions = (list) => {
				items = list;
				paint();
			};
			b.addEventListener("click", (e) => {
				e.preventDefault();
				if (openPop && openPop.trigger === b) return closePop();
				const panel = popPanel();
				panel.style.maxHeight = "360px";
				panel.style.overflowY = "auto";
				const withLead = items.some((i) => i.lead);
				[{ value: "", label: allLabel }].concat(items).forEach((it) => {
					const lead = it.lead ? it.lead() : withLead ? el("span", "width:24px;flex:0 0 auto;") : null;
					const row = menuRow(lead, it.label, it.value === value);
					row.addEventListener("click", () => {
						closePop();
						if (it.value === value) return;
						b.value = it.value;
						b.dispatchEvent(new Event("change"));
					});
					panel.append(row);
				});
				openPopover(b, panel);
			});
			paint();
			return b;
		};

		// Calendar popup — the Figma file has no date picker, so it reuses the dropdown panel, list-item and brand tokens.
		const pad2 = (n) => String(n).padStart(2, "0");
		const isoOf = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
		const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		const datePicker = () => {
			const b = trigger(SVG.calendar);
			let value = "";
			const paint = () => b.setText(value ? value.split("-").reverse().join("/") : "dd/mm/yyyy", !value);
			Object.defineProperty(b, "value", {
				get: () => value,
				set: (v) => {
					value = v || "";
					paint();
				},
			});
			b.limits = () => ({}); // { min, max, range: [from, to] } — wired after both pickers exist
			const choose = (v) => {
				closePop();
				if (v === value) return;
				b.value = v;
				b.dispatchEvent(new Event("change"));
			};
			const navBtn = (svg, onClick) => {
				const n = el("button", "display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;border-radius:8px;background:none;cursor:pointer;color:" + T.text500 + ";");
				n.type = "button";
				n.innerHTML = svg;
				n.addEventListener("mouseenter", () => (n.style.background = hoverBg));
				n.addEventListener("mouseleave", () => (n.style.background = "none"));
				n.addEventListener("click", onClick);
				return n;
			};
			const draw = (panel, month) => {
				panel.replaceChildren();
				const lim = b.limits();
				const range = lim.range || [];
				const today = isoOf(new Date());
				const head = el("div", "display:flex;align-items:center;gap:4px;padding:0 0 4px;");
				const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
				const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
				head.append(
					navBtn(SVG.left, () => draw(panel, prev)),
					el("span", "flex:1;text-align:center;font:600 16px/24px " + T.font + ";color:" + T.text900 + ";", MONTHS[month.getMonth()] + " " + month.getFullYear()),
					navBtn(SVG.right, () => draw(panel, next))
				);
				const grid = el("div", "display:grid;grid-template-columns:repeat(7,36px);gap:2px;");
				["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach((d) =>
					grid.append(el("span", "height:32px;display:flex;align-items:center;justify-content:center;font:500 12px/18px " + T.font + ";color:" + T.text300 + ";", d))
				);
				const start = new Date(month.getFullYear(), month.getMonth(), 1 - ((month.getDay() + 6) % 7));
				for (let i = 0; i < 42; i++) {
					const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
					const v = isoOf(d);
					const inMonth = d.getMonth() === month.getMonth();
					const off = (lim.min && v < lim.min) || (lim.max && v > lim.max);
					const sel = v === value;
					const inRange = !sel && range[0] && range[1] && v > range[0] && v < range[1];
					const cell = el(
						"button",
						"position:relative;height:36px;border:0;border-radius:8px;padding:0;font:" + (sel ? 600 : 500) + " 14px/20px " + T.font + ";" +
							"background:" + (sel ? T.brand : inRange ? T.brandSoftBg : "none") + ";" +
							"color:" + (sel ? "#ffffff" : v === today ? T.brandSoftText : inMonth ? T.text900 : T.text300) + ";" +
							"cursor:" + (off ? "default" : "pointer") + ";opacity:" + (off ? 0.35 : 1) + ";",
						String(d.getDate())
					);
					cell.type = "button";
					if (v === today && !sel) cell.append(el("span", "position:absolute;left:50%;bottom:5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:" + T.brand + ";"));
					if (!off) {
						if (!sel) {
							cell.addEventListener("mouseenter", () => (cell.style.background = hoverBg));
							cell.addEventListener("mouseleave", () => (cell.style.background = inRange ? T.brandSoftBg : "none"));
						}
						cell.addEventListener("click", () => choose(v));
					}
					grid.append(cell);
				}
				const foot = el("div", "display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:8px;border-top:1px solid " + T.divider + ";");
				const footBtn = (text, color, onClick) => {
					const f = el("button", "border:0;background:none;border-radius:8px;padding:6px 10px;cursor:pointer;font:500 14px/20px " + T.font + ";color:" + color + ";", text);
					f.type = "button";
					f.addEventListener("mouseenter", () => (f.style.background = hoverBg));
					f.addEventListener("mouseleave", () => (f.style.background = "none"));
					f.addEventListener("click", onClick);
					return f;
				};
				const todayOff = (lim.min && today < lim.min) || (lim.max && today > lim.max);
				foot.append(
					footBtn("Clear", T.text500, () => choose("")),
					todayOff ? el("span") : footBtn("Today", T.brandSoftText, () => choose(today))
				);
				panel.append(head, grid, foot);
			};
			b.addEventListener("click", (e) => {
				e.preventDefault();
				if (openPop && openPop.trigger === b) return closePop();
				const panel = popPanel();
				panel.style.padding = "12px";
				const base = value ? new Date(value + "T00:00:00") : new Date();
				draw(panel, new Date(base.getFullYear(), base.getMonth(), 1));
				openPopover(b, panel);
			});
			paint();
			return b;
		};
		const field = (label, control, width) => {
			const f = el("label", "display:flex;flex-direction:column;gap:6px;min-width:0;");
			f.append(el("span", "font:500 14px/20px " + T.font + ";color:" + T.text900 + ";white-space:nowrap;", label));
			control.style.width = width;
			f.append(control);
			return f;
		};
		const group = (title, children) => {
			const g = el("div", "display:flex;flex-direction:column;gap:8px;padding:0 20px;border-left:1px solid " + T.divider + ";");
			g.append(el("span", "font:600 12px/18px " + T.font + ";letter-spacing:.06em;text-transform:uppercase;color:" + T.text300 + ";", title));
			const row = el("div", "display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;");
			children.forEach((c) => row.append(c));
			g.append(row);
			return g;
		};
		const agentSel = dropdown("All agents");
		const prioSel = dropdown("All priorities");
		const teamSel = dropdown("All teams");
		teamSel.setOptions([{ value: "Sales", label: "Sales" }, { value: "Technical", label: "Technical" }]);
		teamSel.title = "Ka yimid / Raised by team";
		const companyIn = focusRing(el("input", inputStyle));
		companyIn.placeholder = "Search company…";
		const fromIn = datePicker();
		fromIn.title = "Opening date from";
		const toIn = datePicker();
		toIn.title = "Opening date to";
		fromIn.limits = () => ({ max: toIn.value, range: [fromIn.value, toIn.value] });
		toIn.limits = () => ({ min: fromIn.value, range: [fromIn.value, toIn.value] });

		// Toggle (Figma Toggle Input): hidden checkbox + 32x18 track + 14px knob.
		const oldChk = el("input", "position:absolute;opacity:0;width:0;height:0;");
		oldChk.type = "checkbox";
		const track = el("span", "position:relative;display:inline-block;width:32px;height:18px;border-radius:10px;transition:background 150ms;background:" + T.toggleOff + ";");
		const knob = el("span", "position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:8px;background:#ffffff;box-shadow:0 4px 4px -2px rgba(16,24,32,0.04);transition:left 150ms;");
		track.append(knob);
		const syncToggle = () => {
			track.style.background = oldChk.checked ? T.brand : T.toggleOff;
			knob.style.left = oldChk.checked ? "16px" : "2px";
		};
		oldChk.addEventListener("change", syncToggle);
		const oldLbl = el("label", "position:relative;display:flex;align-items:center;gap:10px;height:40px;cursor:pointer;font:500 14px/20px " + T.font + ";color:" + T.text900 + ";white-space:nowrap;");
		oldLbl.append(oldChk, el("span", null, "Show closed > " + OLD_CLOSED_DAYS + " days"), el("span", "display:inline-flex;align-items:center;width:40px;height:24px;justify-content:center;", ""));
		oldLbl.lastChild.append(track);

		const whoGroup = group("Who", [field("Assigned to", agentSel, "180px"), field("Team", teamSel, "140px"), field("Company", companyIn, "190px")]);
		whoGroup.style.borderLeft = "0";
		whoGroup.style.paddingLeft = "0";
		const dateRow = el("div", "display:flex;align-items:flex-end;gap:8px;");
		dateRow.append(field("From", fromIn, "150px"), el("span", "height:40px;display:flex;align-items:center;color:" + T.text300 + ";", "→"), field("To", toIn, "150px"));
		bar.append(
			whoGroup,
			group("What", [field("Priority", prioSel, "150px")]),
			group("Opened", [dateRow]),
			group("Options", [oldLbl])
		);
		const hiddenBox = el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:auto;");

		// Section 3: quick numbers for the current filters (Figma Number + badge, compact).
		const stats = el(
			"div",
			"display:flex;flex-wrap:wrap;gap:8px 32px;align-items:center;padding:10px 24px;background:" + T.surface + ";border-bottom:1px solid " + T.divider + ";font-family:" + T.font + ";"
		);
		const stat = (label, color) => {
			const s = el("div", "display:flex;align-items:baseline;gap:8px;");
			const dot = el("span", "width:8px;height:8px;border-radius:50%;align-self:center;background:" + color + ";");
			const value = el("span", "font:600 20px/28px " + T.font + ";color:" + T.text900 + ";", "–");
			s.append(dot, el("span", "font:500 14px/20px " + T.font + ";color:" + T.text500 + ";", label), value);
			stats.append(s);
			return value;
		};
		const statOpen = stat("Open", "#1363df"); // functional-blue (500)
		const statPaused = stat("Paused", "#ecad4b");
		const statDone = stat("Resolved (" + OLD_CLOSED_DAYS + "d)", T.brand);
		const statFailed = stat("SLA failed (open)", "#d13438"); // functional-red (500)
		stats.append(hiddenBox);
		// Expose helpers to the board code further down.
		const btnStyle =
			"padding:6px 12px;border-radius:8px;border:1px solid " + T.border + ";background:" + T.surface + ";" +
			"color:" + T.text900 + ";cursor:pointer;font:500 13px/18px " + T.font + ";";

		const board = el("div", "flex:1;display:flex;gap:8px;padding:16px 24px;overflow-x:auto;overflow-y:hidden;background:" + (dark ? T.surface : "#ffffff") + ";font-family:" + T.font + ";");
		root.append(header, bar, stats, board);
		board.append(el("div", "color:var(--ink-gray-5,#888);padding:20px;", "Loading…"));

		// Reference data
		let statuses, agents, priorities, me, saved, userSettings, techTeam, salesTeam;
		try {
			[statuses, agents, priorities, me, saved, userSettings, techTeam, salesTeam] = await Promise.all([
				getList("HD Ticket Status", ["name", "category", "order", "color"], [["enabled", "=", 1]]),
				getList("HD Agent", ["name", "agent_name", "user_image"], [["is_active", "=", 1], ["name", "!=", "Administrator"]], {
					order_by: "agent_name asc",
				}),
				getList("HD Ticket Priority", ["name"], []),
				api("helpdesk.api.auth.get_user"),
				api("frappe.client.get_single_value", { doctype: SETTINGS, field: "config" }).catch(() => null),
				api("frappe.model.utils.user_settings.get", { doctype: "HD Ticket" }).catch(() => null),
				// HD Team Member cannot be get_list'ed from the client — use Helpdesk's own API.
				api("helpdesk.helpdesk.doctype.hd_team.hd_team.get_team_members", { team: "Technical" }).catch(() => null),
				api("helpdesk.helpdesk.doctype.hd_team.hd_team.get_team_members", { team: "Sales" }).catch(() => null),
			]);
		} catch (e) {
			board.textContent = "Could not load the board: " + e.message;
			return;
		}
		const canEdit = !!(me && (me.is_manager || me.is_admin));
		// WhatsApp master switch: pauses / resumes every automatic WhatsApp (customers and agents); private notes still go.
		const waBtn = el("button", textBtnStyle);
		waBtn.type = "button";
		const waDot = el("span", "width:8px;height:8px;border-radius:50%;flex:0 0 auto;");
		const waLab = el("span");
		waBtn.append(waDot, waLab);
		let waPaused = false;
		let waInfo = {}; // templates: { whatsapp_paused, rows: [{ status, enabled, message }] }
		const paintWa = () => {
			waDot.style.background = waPaused ? "#d92d20" : T.brand;
			waLab.textContent = waPaused ? "WhatsApp paused" : "WhatsApp on";
			waBtn.style.color = waPaused ? "#b42318" : T.text500;
			waBtn.title = waPaused
				? "Automatic WhatsApp messages are stopped" + (canEdit ? " — click to resume" : "")
				: "Automatic WhatsApp messages are sent" + (canEdit ? " — click to pause" : "");
		};
		waBtn.addEventListener("mouseenter", () => (waBtn.style.background = T.subtle));
		waBtn.addEventListener("mouseleave", () => (waBtn.style.background = "none"));
		const setWa = async (paused) => {
			try {
				const m = await api("chatwoot_message_templates", { action: "pause", payload: { paused: paused ? 1 : 0 } }, true);
				waInfo = (m || {}).templates || waInfo;
				waPaused = !!waInfo.whatsapp_paused;
				paintWa();
				toast(waPaused ? "WhatsApp messages paused — nothing is sent until you resume" : "WhatsApp messages resumed", !waPaused);
			} catch (e) {
				toast("Could not change WhatsApp: " + e.message, false);
			}
		};
		waBtn.addEventListener("click", () => {
			if (!canEdit) return toast("Only managers can pause or resume WhatsApp messages.", false);
			showMenu2(
				waBtn,
				(waPaused
					? [{ label: "Resume WhatsApp messages", onClick: () => setWa(false) }]
					: [{ label: "Pause all WhatsApp messages", danger: true, onClick: () => setWa(true) }]
				).concat([{ label: "⚙  Team numbers / Numbarrada kooxaha", onClick: () => openTeamNumbers() }])
			);
		});
		api("chatwoot_message_templates", { action: "get" })
			.then((m) => {
				waInfo = (m || {}).templates || {};
				waPaused = !!waInfo.whatsapp_paused;
				paintWa();
				actions.prepend(waBtn);
			})
			.catch(() => {}); // integration not readable for this user: no switch shown
		if (canEdit) {
			const msgBtn = el("button", textBtnStyle, "💬  Customer messages");
			msgBtn.addEventListener("mouseenter", () => (msgBtn.style.background = T.subtle));
			msgBtn.addEventListener("mouseleave", () => (msgBtn.style.background = "none"));
			msgBtn.addEventListener("click", () => openMsgEditor(visibleColumns()));
			actions.insertBefore(msgBtn, expandBtn);
		}
		const agentNames = {};
		agents.forEach((a) => (agentNames[a.name] = a));
		// Agent pickers (Who filter, Assign menu, new-ticket Assign to) list HD Team "Technical"
		// members only (managed at /helpdesk/teams); an empty/unreachable team falls back to all
		// active agents — same rule as the Agent Ticket Report. agentNames keeps everyone, so
		// cards and the preview still label assignees who are not in the team.
		const techSet = new Set((techTeam || []).filter(Boolean));
		// The user's own intake team (new-ticket "Team" default); Sales wins if someone is in both.
		const salesSet = new Set((salesTeam || []).filter(Boolean));
		const myId = (me && me.user_id) || "";
		const myTeam = salesSet.has(myId) ? "Sales" : techSet.has(myId) ? "Technical" : "";
		// New-ticket defaults for a user: { team, status ("" = CUSUB), locked }. Sales-only members are locked to the
		// Sales team + SALES column (when HD Ticket Status "Sales" is enabled) so their work never lands in a technical column.
		const newTicketDefaults = (user) => {
			const inSales = salesSet.has(user);
			const inTech = techSet.has(user);
			const team = inSales ? "Sales" : inTech ? "Technical" : "";
			const lane = statuses.some((s) => s.name === "Sales");
			return { team, status: team === "Sales" && lane ? "Sales" : "", locked: inSales && !inTech };
		};
		state.newTicketDefaults = newTicketDefaults;
		if (techSet.size) {
			const techAgents = agents.filter((a) => techSet.has(a.name));
			if (techAgents.length) agents = techAgents;
		}
		let config = {};
		try {
			config = (saved && JSON.parse(saved)) || {};
		} catch (e) {
			config = {};
		}
		config.columns = config.columns || {};

		// This user's layout: { collapsed: { status: bool }, order: [status, ...] }.
		let layout = {};
		try {
			layout = (JSON.parse(userSettings || "{}") || {}).yool_kanban || {};
		} catch (e) {
			layout = {};
		}
		layout.collapsed = layout.collapsed || {};
		let layoutTimer = null;
		const saveLayout = () => {
			clearTimeout(layoutTimer);
			layoutTimer = setTimeout(() => {
				api(
					"frappe.model.utils.user_settings.save",
					{ doctype: "HD Ticket", user_settings: JSON.stringify({ yool_kanban: layout }) },
					true
				).catch((e) => toast("Could not save your board layout: " + e.message));
			}, 400);
		};

		// Agent rows lead with initials (Figma "Avatar" list item); priority rows with a status dot (Figma "Dot" list item).
		const initialsOf = (name) =>
			(name || "?")
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((w) => w.charAt(0).toUpperCase())
				.join("");
		agentSel.setOptions(
			agents.map((a) => {
				const label = a.agent_name || a.name;
				return {
					label,
					value: a.name,
					lead: () =>
						el(
							"span",
							"width:24px;height:24px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
								"font:600 10px/1 " + T.font + ";background:" + T.brandSoftBg + ";color:" + T.brandSoftText + ";",
							initialsOf(label)
						),
				};
			})
		);
		const PRIORITY_DOT = { Urgent: "#be2f33", Critical: "#be2f33", High: "#f38744", Medium: "#1db487", Low: "#8f9193" };
		prioSel.setOptions(
			priorities.map((p) => ({
				label: p.name,
				value: p.name,
				lead: () => {
					const box = el("span", "width:24px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;");
					box.append(el("span", "width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 2px " + T.surface + ";background:" + (PRIORITY_DOT[p.name] || T.text300) + ";"));
					return box;
				},
			}))
		);

		// Column model: status record + display settings
		const colSettings = (s) => config.columns[s.name] || {};
		const colLabel = (s) => colSettings(s).label || s.name;
		const colColor = (s) => colSettings(s).color || COLORS[(s.color || "").charAt(0).toUpperCase() + (s.color || "").slice(1).toLowerCase()] || COLORS.Gray;
		// Default order: Open → Paused → Resolved, then the status's own order; saved order wins.
		const CATEGORY_RANK = { Open: 0, Paused: 1, Resolved: 2 };
		const defaultOrder = (s) => 1000 + (CATEGORY_RANK[s.category] != null ? CATEGORY_RANK[s.category] : 3) * 100 + (s.order || 0);
		const sharedOrder = (s) => (colSettings(s).order != null ? colSettings(s).order : defaultOrder(s));
		const ordered = () => {
			const mine = Array.isArray(layout.order) ? layout.order : [];
			// A column missing from the user's saved order (e.g. the new SALES) is slotted in before the first saved
			// column that comes after it in the shared order, instead of landing at the far end.
			const rank = (s) => {
				const i = mine.indexOf(s.name);
				if (i >= 0) return i;
				if (!mine.length) return 10000 + sharedOrder(s);
				const so = sharedOrder(s);
				const j = mine.findIndex((n) => {
					const x = statuses.find((y) => y.name === n);
					return x && sharedOrder(x) > so;
				});
				return (j >= 0 ? j : mine.length) - 0.5 + (so + 5000) / 1e7;
			};
			return statuses.slice().sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
		};

		const saveConfig = async () => {
			try {
				await api(
					"frappe.client.set_value",
					{ doctype: SETTINGS, name: SETTINGS, fieldname: "config", value: JSON.stringify(config) },
					true
				);
			} catch (e) {
				toast("Could not save board settings: " + e.message);
			}
		};
		const updateColumn = async (status, patch) => {
			config.columns[status] = Object.assign({}, config.columns[status] || {}, patch);
			await saveConfig();
			render();
		};
		// Column order is per user (drag handle / Move left-right).
		const moveColumn = (status, delta) => {
			const list = ordered().map((s) => s.name);
			const i = list.indexOf(status);
			const j = i + delta;
			if (i < 0 || j < 0 || j >= list.length) return;
			list.splice(j, 0, list.splice(i, 1)[0]);
			layout.order = list;
			saveLayout();
			render();
		};
		const moveColumnBefore = (status, target) => {
			if (status === target) return;
			const list = ordered()
				.map((s) => s.name)
				.filter((n) => n !== status);
			list.splice(list.indexOf(target), 0, status);
			layout.order = list;
			saveLayout();
			render();
		};
		// Managers: make their current order the default for users without their own order.
		const saveOrderForEveryone = async () => {
			ordered().forEach((s, idx) => (config.columns[s.name] = Object.assign({}, config.columns[s.name] || {}, { order: idx })));
			await saveConfig();
			toast("Column order saved as the default for everyone.", true);
		};

		// Filters → Frappe filter list
		const filters = { agent: "", team: "", priority: "", company: "", from: "", to: "", showOld: false };
		let companyIds = null;
		const baseFilters = () => {
			const f = [];
			if (filters.agent) f.push(["_assign", "like", '%"' + escapeLike(filters.agent) + '"%']);
			if (filters.team) f.push(["source_team", "=", filters.team]);
			if (filters.priority) f.push(["priority", "=", filters.priority]);
			if (filters.from) f.push(["opening_date", ">=", filters.from]);
			if (filters.to) f.push(["opening_date", "<=", filters.to]);
			if (companyIds) f.push(["customer", "in", companyIds.length ? companyIds : ["__none__"]]);
			return f;
		};
		const columnFilters = (s) => {
			const f = baseFilters().concat([["status", "=", s.name]]);
			if (s.category === "Resolved" && !filters.showOld) f.push(["modified", ">=", daysAgo(OLD_CLOSED_DAYS)]);
			return f;
		};

		// Per-column data
		const columns = {}; // status -> { tickets: [], count, loading }
		const customerNames = {};
		const FIELDS = [
			"name",
			"subject",
			"status",
			"priority",
			"customer",
			"erp_customer_name",
			"caller_name",
			"agreement_status",
			"response_by",
			"resolution_by",
			"first_responded_on",
			"_assign",
			"source_team",
		];
		const fillCustomerNames = async (tickets) => {
			const ids = [...new Set(tickets.filter((t) => t.customer && !t.erp_customer_name && !customerNames[t.customer]).map((t) => t.customer))];
			if (!ids.length) return;
			const rows = await getList("Customer", ["name", "customer_name"], [["name", "in", ids]]).catch(() => []);
			rows.forEach((r) => (customerNames[r.name] = r.customer_name));
		};
		const loadColumn = async (s, more) => {
			const col = columns[s.name] || (columns[s.name] = { tickets: [], count: 0 });
			col.loading = true;
			const start = more ? col.tickets.length : 0;
			const [rows, count] = await Promise.all([
				getList("HD Ticket", FIELDS, columnFilters(s), {
					order_by: "modified desc",
					limit_start: start,
					limit_page_length: PAGE,
				}),
				more ? Promise.resolve(col.count) : api("frappe.client.get_count", { doctype: "HD Ticket", filters: columnFilters(s) }),
			]);
			await fillCustomerNames(rows);
			col.tickets = more ? col.tickets.concat(rows) : rows;
			col.count = count;
			col.loading = false;
		};
		let loadToken = 0;
		let slaFailedOpen = null;
		// Header numbers from the loaded column counts (hidden columns are not counted).
		const updateStats = () => {
			const sum = (category) =>
				statuses
					.filter((x) => x.category === category && columns[x.name] && !colSettings(x).hidden)
					.reduce((n, x) => n + (columns[x.name].count || 0), 0);
			const open = sum("Open");
			const paused = sum("Paused");
			const done = sum("Resolved");
			statOpen.textContent = String(open);
			statPaused.textContent = String(paused);
			statDone.textContent = String(done);
			statFailed.textContent = slaFailedOpen == null ? "–" : String(slaFailedOpen);
			totalPill.textContent = open + paused + done + " tickets";
		};
		const loadAll = async () => {
			const token = ++loadToken;
			board.textContent = "";
			board.append(el("div", "color:var(--ink-gray-5,#888);padding:20px;", "Loading…"));
			try {
				const openStatuses = statuses.filter((x) => x.category !== "Resolved").map((x) => x.name);
				const [, failed] = await Promise.all([
					Promise.all(ordered().filter((s) => !colSettings(s).hidden).map((s) => loadColumn(s))),
					api("frappe.client.get_count", {
						doctype: "HD Ticket",
						filters: baseFilters().concat([["agreement_status", "=", "Failed"], ["status", "in", openStatuses]]),
					}).catch(() => null),
				]);
				slaFailedOpen = failed;
			} catch (e) {
				if (token === loadToken) board.textContent = "Could not load tickets: " + e.message;
				return;
			}
			if (token === loadToken) render();
		};

		// ---------- rendering (Figma "UI-dinsg": Badge Outline/Small, Avatar, card tokens) ----------
		// Badge colours: [bg *-primary (50), border *-secondary (200), text *-secondary (700)].
		const BADGE = dark
			? {
					gray: ["var(--surface-gray-2, #2b2b2b)", "var(--outline-gray-2, #343434)", "var(--ink-gray-7, #afafaf)"],
					red: ["rgba(209, 52, 56, 0.14)", "rgba(234, 162, 163, 0.35)", "#f1a2a4"],
					yellow: ["rgba(250, 146, 0, 0.14)", "rgba(255, 227, 189, 0.3)", "#ffb547"],
					green: ["rgba(17, 147, 13, 0.16)", "rgba(146, 212, 144, 0.35)", "#7fd27c"],
					blue: ["rgba(17, 90, 203, 0.18)", "rgba(146, 183, 240, 0.35)", "#92b7f0"],
			  }
			: {
					gray: ["#ffffff", "#dadadb", "#070a0e"],
					red: ["#faebeb", "#eaa2a3", "#942528"],
					yellow: ["#fff9f0", "#ffe3bd", "#db8000"],
					green: ["#e7f6e7", "#92d490", "#0d720a"],
					blue: ["#e7effc", "#92b7f0", "#0d469e"],
			  };
		const badge = (tone, text) => {
			const c = BADGE[tone] || BADGE.gray;
			return el(
				"span",
				"display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:4px;white-space:nowrap;" +
					"border:1px solid " + c[1] + ";background:" + c[0] + ";color:" + c[2] + ";font:500 12px/18px " + T.font + ";",
				text
			);
		};
		const PRIORITY_TONE = { Urgent: "red", High: "yellow" };
		// source_team = Sales: brand-green badge (work raised by the Sales team for Technical).
		const salesBadge = () => {
			const b = badge("gray", "Sales");
			b.style.background = T.brandSoftBg;
			b.style.borderColor = T.brand;
			b.style.color = T.brandSoftText;
			b.style.fontWeight = "600";
			b.title = "Ka yimid Kooxda Sales / Raised by the Sales team";
			return b;
		};
		// Static icons (no user data) in the Figma 1.5px stroke style.
		const ICON = {
			company:
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h2a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/></svg>',
			phone:
				'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
		};
		const metaRow = (icon, text) => {
			const r = el("div", "display:flex;align-items:center;gap:6px;min-width:0;color:" + T.text500 + ";font:500 12px/18px " + T.font + ";");
			const i = el("span", "display:inline-flex;flex:0 0 auto;color:" + T.text300 + ";");
			i.innerHTML = icon; // static SVG constant
			r.append(i, el("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", text));
			return r;
		};
		const slaBadge = (t, s) => {
			if (t.agreement_status === "Failed") return ["SLA failed", "red"];
			if (s.category === "Resolved") return t.agreement_status === "Fulfilled" ? ["Fulfilled", "green"] : null;
			if (s.category === "Paused") return ["Paused", "gray"];
			const due = !t.first_responded_on ? t.response_by : t.resolution_by;
			if (!due) return null;
			const ms = new Date(String(due).replace(" ", "T")).getTime() - Date.now();
			if (isNaN(ms)) return null;
			if (ms < 0) return ["Overdue", "red"];
			const h = Math.floor(ms / 3600000);
			const m = Math.floor((ms % 3600000) / 60000);
			return [(h >= 24 ? Math.floor(h / 24) + "d " + (h % 24) + "h" : h + "h " + m + "m") + " left", "yellow"];
		};
		const avatar = (user, index) => {
			const a = agentNames[user] || { agent_name: user };
			const name = a.agent_name || user;
			const base =
				"width:24px;height:24px;border-radius:50%;flex:0 0 auto;box-sizing:content-box;border:2px solid " + T.surface + ";" +
				(index ? "margin-left:-8px;" : "");
			if (a.user_image) {
				const img = el("img", base + "object-fit:cover;");
				img.src = a.user_image;
				img.alt = name;
				img.title = name;
				return img;
			}
			const initials = name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((p) => p[0].toUpperCase())
				.join("");
			const d = el(
				"div",
				base + "display:flex;align-items:center;justify-content:center;font:600 10px/1 " + T.font + ";background:" + T.brandSoftBg + ";color:" + T.brandSoftText + ";",
				initials
			);
			d.title = name;
			return d;
		};
		const card = (t, s) => {
			const shadow = "0 1px 2px rgba(0, 0, 0, 0.06)";
			const c = el(
				"div",
				"background:" + T.surface + ";border:1px solid " + T.divider + ";border-radius:8px;padding:12px;cursor:pointer;" +
					"display:flex;flex-direction:column;gap:8px;font-family:" + T.font + ";box-shadow:" + shadow + ";" +
					"transition:box-shadow 150ms ease, border-color 150ms ease;"
			);
			c.addEventListener("mouseenter", () => {
				c.style.borderColor = T.border;
				c.style.boxShadow = "0 4px 12px rgba(7, 10, 14, 0.08)";
			});
			c.addEventListener("mouseleave", () => {
				if (PV.name === String(t.name)) return highlight(t.name, true);
				c.style.borderColor = T.divider;
				c.style.boxShadow = shadow;
			});
			c.draggable = true;
			c.addEventListener("dragstart", (e) => {
				e.dataTransfer.setData("text/plain", t.name);
				e.dataTransfer.effectAllowed = "move";
				state.dragging = { ticket: t, from: s.name };
				state.draggingColumn = null;
				c.style.opacity = "0.5";
			});
			c.addEventListener("dragend", () => {
				c.style.opacity = "1";
				state.dragging = null;
			});
			c.addEventListener("click", () => router.push({ name: "TicketAgent", params: { ticketId: String(t.name) } }));
			// Keyboard: Space previews, Enter opens the ticket.
			c.tabIndex = 0;
			c.setAttribute("aria-label", "Ticket #" + t.name + ": " + (t.subject || "(no subject)"));
			c.addEventListener("keydown", (e) => {
				if (e.target !== c) return;
				if (e.key === " ") {
					e.preventDefault();
					openPreview(t.name, c);
				} else if (e.key === "Enter") {
					e.preventDefault();
					router.push({ name: "TicketAgent", params: { ticketId: String(t.name) } });
				}
			});
			cardEls[t.name] = c;

			// Row 1: ticket ID + priority on the left, SLA on the right.
			const top = el("div", "display:flex;align-items:center;gap:6px;");
			top.append(el("span", "font:600 12px/18px " + T.font + ";color:" + T.text300 + ";", String(t.name)));
			if (t.priority) top.append(badge(PRIORITY_TONE[t.priority] || "gray", t.priority));
			if (t.source_team === "Sales") top.append(salesBadge());
			const sla = slaBadge(t, s);
			if (sla) {
				const b = badge(sla[1], sla[0]);
				b.style.marginLeft = "auto";
				top.append(b);
			}
			const kebab = cardMenuButton(t, c);
			kebab.style.marginLeft = sla ? "4px" : "auto";
			top.append(kebab);
			c.append(top);
			// Row 2: subject.
			c.append(
				el(
					"div",
					"font:600 14px/20px " + T.font + ";color:" + T.text900 + ";display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;",
					t.subject || "(no subject)"
				)
			);
			// Row 3: company / caller.
			const company = t.erp_customer_name || customerNames[t.customer] || t.customer;
			if (company || t.caller_name) {
				const meta = el("div", "display:flex;flex-direction:column;gap:2px;");
				if (company) meta.append(metaRow(ICON.company, company));
				if (t.caller_name) meta.append(metaRow(ICON.phone, t.caller_name));
				c.append(meta);
			}
			// Footer: assignees.
			let users = [];
			try {
				users = JSON.parse(t._assign || "[]") || [];
			} catch (e) {
				users = [];
			}
			const foot = el("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid " + T.divider + ";min-height:28px;");
			const who = el(
				"span",
				"font:500 12px/18px " + T.font + ";color:" + (users.length ? T.text500 : T.text300) + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
				users.length ? users.map((u) => (agentNames[u] || {}).agent_name || u).join(", ") : "Unassigned"
			);
			const faces = el("div", "display:flex;align-items:center;");
			users.slice(0, 3).forEach((u, i) => faces.append(avatar(u, i)));
			foot.append(who, faces);
			c.append(foot);
			if (PV.name === String(t.name)) highlight(t.name, true);
			return c;
		};

		// ---------- ticket type guard ----------
		// Server Script "HD Ticket Type Required" blocks moving a ticket to a Resolved-category
		// status (except Cancelled) while ticket_type is empty / "Unspecified". Instead of a
		// dead-end error, ask for the type in a small modal, save it, then do the move.
		// The server script stays as the safety net; this only front-runs it.
		const needsTypeForStatus = (to) => {
			const s = statuses.find((x) => x.name === to);
			return !!s && s.category === "Resolved" && to !== "Cancelled";
		};
		const TYPE_GUARD_RE = /dooro nooca cilada|ticket type before closing/i;
		let ticketTypesCache = null; // fetched once per board
		const loadTicketTypes = async () => {
			if (!ticketTypesCache)
				ticketTypesCache = (await getList("HD Ticket Type", ["name"], [["name", "!=", "Unspecified"]], { order_by: "name asc" })).map((r) => r.name);
			return ticketTypesCache;
		};
		// New type names from the picker: trim, collapse spaces, capitalise all-lowercase words;
		// words typed with any capital ("POS", "UOM", "iPhone") are kept exactly as typed.
		const tidyTypeName = (s) =>
			String(s || "")
				.trim()
				.replace(/\s+/g, " ")
				.replace(/[A-Za-z0-9]+/g, (w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w));
		const ticketTypeNameError = (s) => {
			if (s.length < 2 || s.length > 60) return "Magaca waa inuu noqdaa 2-60 xaraf / The name must be 2 to 60 characters.";
			if (!/^[A-Za-z0-9 &\/-]+$/.test(s)) return "Isticmaal xarfo, tirooyin, boos, & - / oo keliya / Use only letters, digits, spaces, & - /.";
			return "";
		};
		// Modal (Figma "UI-dinsg": modal + input + Primary / Secondary buttons, square corners):
		// searchable HD Ticket Type list with checkboxes — one OR MORE types per ticket. Order of selection is
		// shown as 1, 2, … badges; #1 is the primary type ("Muhiim / Primary"), saved into HD Ticket.ticket_type
		// (reports / totals / SLA / "HD Ticket Type Required" keep using it); all picks go to ticket_types.
		// `initial` pre-checks existing picks. Resolves to the ordered array, or null on Cancel / Esc.
		// Keys: ↑/↓ highlight, Enter toggles the highlighted row (or the "+ Add" row) and clears the search;
		// Enter with nothing highlighted, or Ctrl/⌘+Enter, confirms.
		const pickTicketType = (ticketName, subject, initial) =>
			new Promise((resolve) => {
				const returnFocus = document.activeElement;
				const overlay = el("div", "position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,10,14,0.4);font-family:" + T.font + ";");
				overlay.dataset.yoolPop = "1";
				overlay.dataset.yoolTypePicker = "1";
				const card = el(
					"div",
					"width:min(440px,100%);box-sizing:border-box;padding:24px;border-radius:0;border:1px solid " + T.border + ";background:" + T.surface + ";" +
						"color:" + T.text900 + ";box-shadow:0 24px 48px -12px rgba(16,24,32,0.18);display:flex;flex-direction:column;gap:12px;"
				);
				card.setAttribute("role", "dialog");
				card.setAttribute("aria-modal", "true");
				card.setAttribute("aria-labelledby", "yool-type-title");
				const title = el("div", "font:600 16px/24px " + T.font + ";", "Dooro nooca cilada / Select ticket type");
				title.id = "yool-type-title";
				const sub = el(
					"div",
					"font:500 13px/20px " + T.font + ";color:" + T.text500 + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
					"#" + ticketName + (subject ? " — " + subject : "")
				);
				const hint = el(
					"div",
					"font:500 12px/18px " + T.font + ";color:" + T.text300 + ";",
					"Dooro hal ama in ka badan — kan 1aad waa muhiim / Pick one or more — #1 is the primary type."
				);
				// Selected chips (in selection order). Click a chip's name to make it primary; × removes it.
				const chips = el("div", "display:none;flex-wrap:wrap;gap:6px;");
				chips.dataset.yoolTypeChips = "1";
				const input = el(
					"input",
					"height:36px;padding:8px 12px;box-sizing:border-box;border-radius:0;border:1px solid " + T.border + ";background:" + T.surface + ";" +
						"color:" + T.text900 + ";font:500 14px/20px " + T.font + ";outline:none;width:100%;"
				);
				input.type = "text";
				input.placeholder = "Raadi / Search…";
				input.addEventListener("focus", () => (input.style.borderColor = T.brand));
				input.addEventListener("blur", () => (input.style.borderColor = T.border));
				const listBox = el("div", "max-height:260px;overflow:auto;display:flex;flex-direction:column;border:1px solid " + T.divider + ";");
				listBox.setAttribute("role", "listbox");
				listBox.setAttribute("aria-multiselectable", "true");
				listBox.append(el("div", "padding:10px 12px;font:500 13px/20px " + T.font + ";color:" + T.text300 + ";", "Loading…"));
				const btns = el("div", "display:flex;justify-content:flex-end;gap:12px;margin-top:4px;");
				const cancel = btnSecondary("Cancel");
				const ok = btnPrimary("OK");
				cancel.style.borderRadius = ok.style.borderRadius = "0";
				btns.append(cancel, ok);
				card.append(title, sub, hint, chips, input, listBox, btns);
				overlay.append(card);
				document.body.append(overlay);
				const chosen = []; // ordered; chosen[0] = primary
				(initial || []).forEach((t) => t && t !== "Unspecified" && !chosen.includes(t) && chosen.push(t));
				let visible = [];
				let allTypes = [];
				let addName = ""; // tidied text offered as "+ Add" ("" = row hidden)
				let adding = false;
				let hl = -1; // keyboard-highlighted row: -1 none, 0..n over [add row?, ...visible]
				const errLine = el("div", "display:none;font:500 13px/20px " + T.font + ";color:#942528;");
				listBox.after(errLine);
				const showErr = (msg) => {
					errLine.textContent = msg || "";
					errLine.style.display = msg ? "block" : "none";
				};
				const setOk = () => {
					const on = chosen.length > 0;
					ok.disabled = !on;
					ok.style.opacity = on ? "1" : "0.5";
					ok.style.cursor = on ? "pointer" : "default";
					ok.textContent = chosen.length > 1 ? "OK (" + chosen.length + ")" : "OK";
				};
				// Square 1, 2, … badge; #1 is brand-filled.
				const orderBadge = (i) =>
					el(
						"span",
						"display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:0;flex:0 0 auto;" +
							"font:600 12px/18px " + T.font + ";" +
							(i === 0 ? "background:" + T.brand + ";color:#ffffff;" : "background:" + T.surface + ";color:" + T.brandSoftText + ";border:1px solid " + T.brand + ";"),
						String(i + 1)
					);
				const renderChips = () => {
					chips.textContent = "";
					chips.style.display = chosen.length ? "flex" : "none";
					chosen.forEach((t, i) => {
						const chip = el(
							"span",
							"display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:2px 4px 2px 2px;box-sizing:border-box;border-radius:0;" +
								"border:1px solid " + (i === 0 ? T.brand : T.border) + ";background:" + (i === 0 ? T.brandSoftBg : T.surface) + ";font:500 13px/20px " + T.font + ";color:" + T.text900 + ";"
						);
						chip.dataset.yoolTypeChip = t;
						const nm = el("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:" + (i ? "pointer" : "default") + ";", t);
						if (i) {
							nm.title = "Ka dhig muhiim / Make primary";
							nm.addEventListener("click", () => {
								chosen.splice(i, 1);
								chosen.unshift(t);
								refresh(true);
							});
						}
						chip.append(orderBadge(i), nm);
						if (i === 0) chip.append(el("span", "font:600 11px/16px " + T.font + ";color:" + T.brandSoftText + ";white-space:nowrap;", "Muhiim / Primary"));
						const x = el("button", "border:0;background:none;padding:0 2px;cursor:pointer;color:" + T.text500 + ";font:600 14px/16px " + T.font + ";", "×");
						x.type = "button";
						x.title = "Ka saar / Remove";
						x.setAttribute("aria-label", "Remove " + t);
						x.addEventListener("click", () => toggle(t));
						chip.append(x);
						chips.append(chip);
					});
				};
				const refresh = (keepHl) => {
					setOk();
					renderChips();
					renderList(allTypes, keepHl);
				};
				const toggle = (t) => {
					const i = chosen.indexOf(t);
					if (i >= 0) chosen.splice(i, 1);
					else chosen.push(t);
					showErr("");
					refresh(true);
				};
				const rowCount = () => (addName ? 1 : 0) + visible.length;
				const renderList = (types, keepHl) => {
					const raw = input.value;
					const q = raw.trim().toLowerCase();
					visible = types.filter((t) => !q || t.toLowerCase().includes(q));
					// "+ Add" row: only when the text has no exact (case-insensitive) match, and never "Unspecified".
					const tidy = tidyTypeName(raw);
					const key = tidy.toLowerCase();
					addName = tidy && key !== "unspecified" && !types.some((t) => t.toLowerCase() === key) ? tidy : "";
					// Default highlight: a single match, else the Add row.
					if (!keepHl) hl = !q ? -1 : visible.length === 1 ? (addName ? 1 : 0) : addName ? 0 : -1;
					if (hl >= rowCount()) hl = rowCount() - 1;
					const prevScroll = listBox.scrollTop;
					listBox.textContent = "";
					if (addName) {
						const isHl = hl === 0;
						const addRow = el(
							"button",
							"display:block;width:100%;text-align:left;padding:8px 12px;box-sizing:border-box;border:0;border-left:3px solid " + T.brand + ";border-radius:0;" +
								"cursor:" + (adding ? "default" : "pointer") + ";font:600 14px/20px " + T.font + ";color:" + T.brand + ";" +
								"background:" + (isHl ? T.brandSoftBg : T.surface) + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
							adding ? "Waa la darayaa / Adding “" + addName + "”…" : "+ Ku dar “" + addName + "” / Add “" + addName + "”"
						);
						addRow.type = "button";
						addRow.dataset.yoolAddType = "1";
						addRow.title = "Samee nooc cusub / Create this ticket type";
						addRow.addEventListener("mouseenter", () => (addRow.style.background = T.brandSoftBg));
						addRow.addEventListener("mouseleave", () => (addRow.style.background = hl === 0 ? T.brandSoftBg : T.surface));
						addRow.addEventListener("click", () => addType());
						listBox.append(addRow);
					}
					if (!visible.length) {
						if (!addName) listBox.append(el("div", "padding:10px 12px;font:500 13px/20px " + T.font + ";color:" + T.text300 + ";", "No matching type"));
						return;
					}
					const off = addName ? 1 : 0;
					visible.forEach((t, i) => {
						const pos = chosen.indexOf(t);
						const selected = pos >= 0;
						const isHl = hl === i + off;
						const bg = () => (chosen.includes(t) ? T.brandSoftBg : hl === i + off ? T.subtle : T.surface);
						const row = el(
							"button",
							"display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 12px;box-sizing:border-box;border:0;border-radius:0;cursor:pointer;" +
								"font:500 14px/20px " + T.font + ";background:" + (selected ? T.brandSoftBg : isHl ? T.subtle : T.surface) + ";color:" + (selected ? T.brandSoftText : T.text900) + ";" +
								(isHl ? "box-shadow:inset 3px 0 0 " + T.brand + ";" : "")
						);
						row.type = "button";
						row.setAttribute("role", "option");
						row.setAttribute("aria-selected", selected ? "true" : "false");
						row.dataset.yoolTypeRow = t;
						const box = el(
							"span",
							"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;box-sizing:border-box;border-radius:0;flex:0 0 auto;" +
								"border:1px solid " + (selected ? T.brand : T.border) + ";background:" + (selected ? T.brand : T.surface) + ";color:#ffffff;font:700 11px/1 " + T.font + ";",
							selected ? "✓" : ""
						);
						const label = el("span", "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", t);
						row.append(box, label);
						if (selected) {
							if (pos === 0) row.append(el("span", "font:600 11px/16px " + T.font + ";color:" + T.brandSoftText + ";white-space:nowrap;", "Muhiim / Primary"));
							row.append(orderBadge(pos));
						}
						row.addEventListener("mouseenter", () => !chosen.includes(t) && (row.style.background = T.subtle));
						row.addEventListener("mouseleave", () => (row.style.background = bg()));
						row.addEventListener("click", () => {
							hl = i + off;
							toggle(t);
						});
						listBox.append(row);
						if (isHl && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
					});
					if (keepHl && hl < 0) listBox.scrollTop = prevScroll;
				};
				// Create the typed HD Ticket Type (Agent role has create on it), or reuse an existing one that
				// differs only in case. Then check it (added to the end of the selection); OK still confirms.
				const addType = async () => {
					if (!addName || adding) return;
					const nm = addName;
					const bad = ticketTypeNameError(nm);
					if (bad) return showErr(bad);
					showErr("");
					adding = true;
					renderList(allTypes, true);
					let final = "";
					try {
						const findExisting = async () =>
							((await getList("HD Ticket Type", ["name"], [["name", "=", nm]], { limit_page_length: 1 }))[0] || {}).name || "";
						final = await findExisting(); // MariaDB compares names case-insensitively
						if (!final) {
							try {
								const d = await api("frappe.client.insert", { doc: { doctype: "HD Ticket Type", name: nm, description: "Added from the Kanban type picker" } }, true);
								final = (d && d.name) || nm;
							} catch (e) {
								final = await findExisting().catch(() => ""); // someone added it meanwhile
								if (!final) throw e;
							}
						}
					} catch (e) {
						adding = false;
						showErr("Lama dari karin / Could not add the type: " + (e.message || "unknown error"));
						renderList(allTypes, true);
						return;
					}
					adding = false;
					if (final.toLowerCase() === "unspecified") {
						showErr("“Unspecified” cannot be used. Pick or add another type.");
						renderList(allTypes, true);
						return;
					}
					if (!allTypes.includes(final)) {
						allTypes.push(final);
						allTypes.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
					}
					if (!chosen.includes(final)) chosen.push(final);
					input.value = "";
					hl = -1;
					refresh(true);
					input.focus();
				};
				const close = (result) => {
					overlay.remove();
					document.removeEventListener("keydown", onKey, true);
					if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
					resolve(result && result.length ? result.slice() : null);
				};
				const onKey = (e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						close(null);
					} else if (e.key === "Enter") {
						e.preventDefault();
						e.stopPropagation();
						if (adding) return;
						const off = addName ? 1 : 0;
						if (!(e.ctrlKey || e.metaKey) && addName && hl === 0) addType();
						else if (!(e.ctrlKey || e.metaKey) && hl >= off && visible[hl - off]) {
							const t = visible[hl - off];
							input.value = "";
							hl = -1;
							toggle(t);
						} else if (chosen.length) close(chosen);
					} else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rowCount()) {
						e.preventDefault();
						e.stopPropagation();
						const n = rowCount();
						hl = e.key === "ArrowDown" ? (hl + 1) % n : hl <= 0 ? n - 1 : hl - 1;
						renderList(allTypes, true);
					} else e.stopPropagation(); // keep board shortcuts out; typing still reaches the input
				};
				document.addEventListener("keydown", onKey, true);
				overlay.addEventListener("mousedown", (e) => e.target === overlay && close(null));
				cancel.addEventListener("click", () => close(null));
				ok.addEventListener("click", () => chosen.length && close(chosen));
				setOk();
				renderChips();
				loadTicketTypes()
					.then((types) => {
						allTypes = types; // same array as the board cache, so added types persist for the board
						// A pre-checked type missing from the list (renamed/legacy) still shows as a row.
						chosen.forEach((t) => !allTypes.includes(t) && allTypes.push(t));
						renderList(types);
						input.addEventListener("input", () => {
							showErr("");
							renderList(allTypes);
						});
						input.focus();
					})
					.catch((e) => {
						listBox.textContent = "";
						listBox.append(el("div", "padding:10px 12px;font:500 13px/20px " + T.font + ";color:" + T.text300 + ";", "Could not load types: " + e.message));
					});
			});
		// Current types of a ticket: primary = ticket_type (unless empty / "Unspecified"); `types` = the ticket_types
		// rows in order with the primary first. Old tickets (only ticket_type) give [ticket_type].
		const readTicketTypes = async (name) => {
			const doc = await api("frappe.client.get", { doctype: "HD Ticket", name: String(name) });
			const primary = doc && doc.ticket_type && doc.ticket_type !== "Unspecified" ? doc.ticket_type : "";
			const rows = ((doc && doc.ticket_types) || []).map((r) => r.ticket_type).filter((x) => x && x !== "Unspecified");
			const types = primary ? [primary].concat(rows.filter((x) => x !== primary)) : rows;
			return { primary, types: [...new Set(types)], subject: (doc && doc.subject) || "" };
		};
		// One save for both fields; Server Script "HD Ticket Type Required" re-syncs them server-side too.
		const saveTicketTypes = async (name, picked) => {
			await api(
				"frappe.client.set_value",
				{ doctype: "HD Ticket", name: String(name), fieldname: { ticket_type: picked[0], ticket_types: picked.map((t) => ({ ticket_type: t })) } },
				true
			);
			if (PV.data && PV.name === String(name)) {
				PV.data.ticket_type = picked[0];
				PV.data.ticket_types = picked.slice();
			}
		};
		// True = go ahead with the status change (type not needed, already set, or picked + saved now).
		// False = the user cancelled (or the type could not be saved): skip the move, no error toast.
		const ensureTicketType = async (name, to) => {
			if (!needsTypeForStatus(to)) return true;
			let info;
			try {
				info = await readTicketTypes(name);
			} catch (e) {
				return true; // could not check: let the server-side guard decide
			}
			if (info.primary) return true;
			const picked = await pickTicketType(name, info.subject, info.types);
			if (!picked) return false;
			try {
				await saveTicketTypes(name, picked);
			} catch (e) {
				toast("#" + name + ": could not save the ticket type: " + e.message);
				return false;
			}
			return true;
		};
		// Preview panel "Edit": re-open the picker with the ticket's current types pre-checked.
		const editTicketTypes = async (name) => {
			const info = await readTicketTypes(name);
			const picked = await pickTicketType(name, info.subject, info.types);
			if (!picked) return false;
			await saveTicketTypes(name, picked);
			return true;
		};
		// Console / test hook: opens the picker WITHOUT saving or moving anything; resolves to the picks or null.
		state.typePicker = {
			open: async (name) => {
				const info = await readTicketTypes(name);
				return pickTicketType(name, info.subject, info.types);
			},
			read: readTicketTypes,
		};

		const moveTicket = async (name, from, to, typeChecked) => {
			if (!name || from === to) return;
			// Closing without a type dead-ends on the server guard — ask for the type first.
			if (!typeChecked && !(await ensureTicketType(name, to))) return; // cancelled: card stays put
			statuses
				.filter((x) => x.name === from || x.name === to)
				.forEach((x) => {
					if (layout.collapsed[x.name] == null) sessionPins[x.name] = isCollapsed(x);
				});
			const src = columns[from];
			const dst = columns[to] || (columns[to] = { tickets: [], count: 0 });
			const idx = src ? src.tickets.findIndex((x) => String(x.name) === String(name)) : -1;
			if (idx < 0) return;
			const t = src.tickets.splice(idx, 1)[0];
			src.count -= 1;
			t.status = to;
			dst.tickets.unshift(t);
			dst.count += 1;
			render();
			try {
				const doc = await api("frappe.client.set_value", { doctype: "HD Ticket", name: String(name), fieldname: "status", value: to }, true);
				if (doc) Object.assign(t, { status: doc.status, agreement_status: doc.agreement_status, _assign: doc._assign });
				render();
			} catch (e) {
				// Not allowed: put the card back and explain why.
				dst.tickets.splice(dst.tickets.indexOf(t), 1);
				dst.count -= 1;
				t.status = from;
				src.tickets.splice(idx, 0, t);
				src.count += 1;
				render();
				// The server guard caught a path the pre-check missed: ask for the type, then retry once.
				if (TYPE_GUARD_RE.test(e.message || "")) {
					if (await ensureTicketType(name, to)) await moveTicket(name, from, to, true);
					return;
				}
				toast("#" + name + " could not be moved: " + e.message);
			}
		};

		// ---------- ticket preview panel ----------
		// Figma "UI-dinsg": Side Menu surface + item states, Buttons (Secondary gray / Ghost gray / Link color / Primary),
		// Pill + Badge, Avatar (Text / Icon), Divider label, Dropdown menu list item. Data comes from the API server
		// script "yool_ticket_preview" (one call: summary, SLA, last 3 messages, last 5 activity entries, can_write).
		const PV_ICON = {
			trash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
			kebab: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
			more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
			eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
			external: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
			link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
			close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
			chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
			arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
			ticket: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" transform="translate(0 1.5)"/><path d="M14 6.5v11" stroke-dasharray="2 2"/></svg>',
			reply: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
			comment: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
			assign: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5"/><path d="M19 15v6M16 18h6"/></svg>',
			status: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/></svg>',
			flag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
			alert: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
		};
		const icn = (svg, size) => {
			const i = el("span", "display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;" + (size ? "width:" + size + "px;height:" + size + "px;" : ""));
			i.innerHTML = svg; // static SVG constants only
			return i;
		};
		const touch = window.matchMedia("(hover: none)").matches;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const ticketUrl = (name) => window.location.origin + "/helpdesk/tickets/" + encodeURIComponent(name);
		const openNewTab = (name) => window.open(ticketUrl(name), "_blank", "noopener");
		const copyLink = (name) =>
			navigator.clipboard.writeText(ticketUrl(name)).then(
				() => toast("Link to #" + name + " copied", true),
				() => toast("Could not copy the link")
			);
		const findTicket = (name) => {
			for (const k in columns) {
				const i = columns[k].tickets.findIndex((x) => String(x.name) === String(name));
				if (i >= 0) return { status: k, index: i, t: columns[k].tickets[i] };
			}
			return null;
		};
		const parseTs = (v) => (v ? new Date(String(v).replace(" ", "T")) : null);
		const fmtDate = (v, withTime) => {
			const d = parseTs(v);
			if (!d || isNaN(d)) return "";
			const opts = { day: "numeric", month: "short", year: "numeric" };
			if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
			return d.toLocaleString("en-GB", opts);
		};
		const ago = (v) => {
			const d = parseTs(v);
			if (!d || isNaN(d)) return "";
			const s = Math.round((Date.now() - d.getTime()) / 1000);
			if (s < 60) return "just now";
			const units = [[86400 * 30, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]];
			for (const u of units) {
				const n = Math.floor(s / u[0]);
				if (n >= 1) return n + " " + u[1] + (n > 1 ? "s" : "") + " ago";
			}
			return "";
		};
		const statusColor = (name) => {
			const s = statuses.find((x) => x.name === name);
			return s ? colColor(s) : T.text300;
		};

		// Figma buttons (Medium 36px): Secondary gray, Ghost gray (icon only) and Link color.
		const btnSecondary = (text, svg) => {
			const b = el(
				"button",
				"display:inline-flex;align-items:center;gap:6px;height:36px;padding:8px 12px;box-sizing:border-box;border-radius:4px;cursor:pointer;" +
					"border:1px solid " + T.border + ";background:" + T.surface + ";color:" + T.text900 + ";font:500 14px/20px " + T.font + ";"
			);
			b.type = "button";
			if (text) b.append(el("span", null, text));
			if (svg) b.append(icn(svg));
			b.addEventListener("mouseenter", () => (b.style.background = T.subtle));
			b.addEventListener("mouseleave", () => (b.style.background = T.surface));
			b.setOpen = (on) => (b.style.borderColor = on ? openBorder : T.border);
			return b;
		};
		const btnGhostIcon = (svg, label) => {
			const b = el(
				"button",
				"display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:8px;box-sizing:border-box;border:0;border-radius:4px;" +
					"background:none;color:" + T.text500 + ";cursor:pointer;"
			);
			b.type = "button";
			b.setAttribute("aria-label", label);
			b.title = label;
			b.append(icn(svg));
			b.addEventListener("mouseenter", () => (b.style.background = hoverBg));
			b.addEventListener("mouseleave", () => (b.style.background = "none"));
			return b;
		};
		const btnLink = (text, svg) => {
			const a = el(
				"a",
				"display:inline-flex;align-items:center;gap:6px;color:" + T.brand + ";font:500 14px/20px " + T.font + ";text-decoration:none;cursor:pointer;"
			);
			a.append(el("span", null, text));
			if (svg) a.append(icn(svg));
			a.addEventListener("mouseenter", () => (a.style.textDecoration = "underline"));
			a.addEventListener("mouseleave", () => (a.style.textDecoration = "none"));
			return a;
		};
		const btnPrimary = (text) => {
			const b = el(
				"button",
				"display:inline-flex;align-items:center;height:36px;padding:8px 14px;box-sizing:border-box;border:0;border-radius:4px;cursor:pointer;" +
					"background:" + T.brand + ";color:#ffffff;font:500 14px/20px " + T.font + ";",
				text
			);
			b.type = "button";
			return b;
		};
		// Figma Pill: white, border-gray-secondary, 120px radius, 8px dot.
		const pillDot = (text, color) => {
			const p = el(
				"span",
				"display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:120px;white-space:nowrap;" +
					"border:1px solid " + T.border + ";background:" + T.surface + ";color:" + T.text900 + ";font:500 14px/20px " + T.font + ";"
			);
			p.append(el("span", "width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:" + color + ";"), el("span", null, text));
			return p;
		};
		// Figma Avatar (Text type): bg-gray-secondary-hover circle, H10 SemiBold initials.
		const avatarOf = (name, image, size) => {
			const s = size || 24;
			const base = "width:" + s + "px;height:" + s + "px;border-radius:50%;flex:0 0 auto;";
			if (image) {
				const img = el("img", base + "object-fit:cover;");
				img.src = image;
				img.alt = "";
				return img;
			}
			return el(
				"span",
				base + "display:inline-flex;align-items:center;justify-content:center;background:" + hoverBg + ";color:" + T.text900 + ";" +
					"font:600 " + (s >= 32 ? 12 : 10) + "px/18px " + T.font + ";",
				initialsOf(name || "?")
			);
		};
		const muted = (text) => el("span", "color:" + T.text300 + ";", text || "--");
		// Dropdown menus (Figma "Dropdown menu list item") anchored to a trigger with setOpen().
		const showMenu2 = (anchor, items) => {
			if (openPop && openPop.trigger === anchor) return closePop();
			const panelEl = popPanel();
			panelEl.setAttribute("role", "menu");
			panelEl.style.maxHeight = "360px";
			panelEl.style.overflowY = "auto";
			items.forEach((it) => {
				const lead = it.lead ? it.lead() : it.icon ? icn(it.icon, 24) : null;
				const row = menuRow(lead, it.label, it.selected);
				row.setAttribute("role", "menuitem");
				row.tabIndex = -1;
				if (it.danger) {
					// Danger rows stay red, also on hover (menuRow resets text colors on hover).
					row.style.color = "#be2f33";
					row.addEventListener("mouseenter", () => (row.style.color = "#b42318"));
					row.addEventListener("mouseleave", () => (row.style.color = "#be2f33"));
				}
				row.addEventListener("click", (e) => {
					e.stopPropagation();
					closePop();
					it.onClick();
				});
				panelEl.append(row);
			});
			if (!anchor.setOpen) anchor.setOpen = () => {};
			openPopover(anchor, panelEl);
			panelEl.style.minWidth = "200px";
			placePop(anchor, panelEl);
		};

		const PV = { name: null, data: null, seq: 0, timer: null, returnFocus: null, open: {}, composing: false };
		const cardEls = {};
		// Desktop: the board and the panel sit side by side as two cards on the grey canvas (the board shrinks,
		// nothing is covered; its filter bar stays on one row). Phones (< 640px): the panel is a full-screen sheet.
		const pvPanel = el(
			"div",
			"z-index:40;display:flex;flex-direction:column;box-sizing:border-box;visibility:hidden;overflow:hidden;" +
				"background:" + T.surface + ";color:" + T.text900 + ";font-family:" + T.font + ";" +
				(reduceMotion ? "" : "transition:transform 200ms ease;")
		);
		pvPanel.dataset.yoolPop = "1";
		pvPanel.setAttribute("role", "dialog");
		pvPanel.setAttribute("aria-modal", "false");
		pvPanel.setAttribute("aria-labelledby", "yool-pv-title");
		const isSheet = () => window.innerWidth < 640;
		const GAP = 8;
		const canvas = dark ? "var(--surface-gray-2, #2a2a2a)" : "#f0f0f1"; // bg-gray-secondary-hover (50)
		if (!reduceMotion) root.style.transition = "inset 200ms ease, border-radius 200ms ease";
		const layoutPanel = () => {
			const sheet = isSheet();
			const open = !!PV.name;
			const w = window.innerWidth < 1280 ? 380 : 440;
			if (sheet) {
				Object.assign(pvPanel.style, { position: "fixed", top: "0", right: "0", bottom: "0", left: "0", width: "100%", borderRadius: "0", border: "0", zIndex: "1000" });
				pvPanel.style.transform = open ? "none" : "translateY(100%)";
			} else {
				Object.assign(pvPanel.style, {
					position: "absolute", top: GAP + "px", right: GAP + "px", bottom: GAP + "px", left: "auto", width: w + "px",
					borderRadius: "12px", border: "1px solid " + T.divider, zIndex: "40",
				});
				pvPanel.style.transform = open ? "none" : "translateX(calc(100% + " + 2 * GAP + "px))";
			}
			const side = open && !sheet;
			root.style.inset = side ? GAP + "px " + (w + 2 * GAP) + "px " + GAP + "px " + GAP + "px" : "0";
			root.style.borderRadius = side ? "12px" : "0";
			root.style.border = side ? "1px solid " + T.divider : "0";
			root.style.overflow = side ? "hidden" : "";
			main.style.background = side ? canvas : state.mainBackground || "";
			// The filter bar keeps its single row while the board is narrower: groups tighten a little and,
			// if still needed, the row scrolls sideways instead of wrapping "Options" onto a second line.
			bar.style.flexWrap = side ? "nowrap" : "wrap";
			bar.style.overflowX = side ? "auto" : "";
			bar.style.scrollbarWidth = side ? "none" : "";
			[...bar.children].forEach((g) => {
				g.style.paddingLeft = side ? "12px" : "20px";
				g.style.paddingRight = side ? "12px" : "20px";
				g.style.flex = side ? "0 0 auto" : "";
			});
			// Same for the stats strip: numbers and the "Hidden columns" chips stay on one line.
			[stats, hiddenBox].forEach((row) => {
				row.style.flexWrap = side ? "nowrap" : "wrap";
				row.style.whiteSpace = side ? "nowrap" : "";
			});
			stats.style.overflowX = side ? "auto" : "";
			stats.style.scrollbarWidth = side ? "none" : "";
			stats.style.columnGap = side ? "24px" : "32px";
			hiddenBox.style.flexShrink = side ? "0" : "";
		};
		main.append(pvPanel);
		window.addEventListener("resize", () => document.body.contains(pvPanel) && layoutPanel());

		// Header: title + close (Figma Ghost gray icon button).
		const pvHead = el("div", "display:flex;align-items:center;gap:8px;padding:16px 20px;border-bottom:1px solid " + T.divider + ";");
		const pvTitle = el("h2", "margin:0;flex:1;font:500 20px/28px " + T.font + ";color:" + T.text900 + ";", "Preview");
		pvTitle.id = "yool-pv-title";
		const pvClose = btnGhostIcon(PV_ICON.close, "Close preview");
		pvHead.append(pvTitle, pvClose);
		// Bar: "View ticket" link + Actions dropdown.
		const pvBar = el("div", "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 20px;border-bottom:1px solid " + T.divider + ";");
		const pvView = btnLink("View ticket");
		pvView.style.fontWeight = "600";
		// Figma "Text gray" button: no border, hover bg-gray-secondary-hover.
		const btnText = (text, svg) => {
			const b = btnSecondary(text, svg);
			b.style.border = "0";
			b.style.background = "none";
			b.style.fontWeight = "600";
			b.style.gap = "4px";
			b.addEventListener("mouseenter", () => (b.style.background = hoverBg));
			b.addEventListener("mouseleave", () => (b.style.background = "none"));
			b.setOpen = (on) => (b.style.background = on ? hoverBg : "none");
			return b;
		};
		const pvActions = btnText("Actions", PV_ICON.chevron);
		pvActions.setAttribute("aria-haspopup", "menu");
		pvBar.append(pvView, pvActions);
		const pvBody = el("div", "flex:1;overflow-y:auto;overscroll-behavior:contain;");
		pvPanel.append(pvHead, pvBar, pvBody);

		const goTicket = (name) => {
			closePreview(true);
			router.push({ name: "TicketAgent", params: { ticketId: String(name) } });
		};
		pvClose.addEventListener("click", () => closePreview());
		pvView.addEventListener("click", (e) => {
			e.preventDefault();
			if (PV.name) goTicket(PV.name);
		});
		pvView.href = "#";

		const setUrl = (name) => {
			const u = new URL(window.location.href);
			if (name) u.searchParams.set("preview", name);
			else u.searchParams.delete("preview");
			window.history.replaceState(window.history.state, "", u.toString());
		};
		const highlight = (name, on) => {
			const c = cardEls[name];
			if (!c) return;
			c.style.borderColor = on ? T.brand : T.divider;
			c.style.background = on ? T.brandSoftBg : T.surface;
			c.style.boxShadow = on ? "0 0 0 1px " + T.brand : "0 1px 2px rgba(0, 0, 0, 0.06)";
			c.setAttribute("aria-current", on ? "true" : "false");
		};

		// Loading skeleton / error state.
		const skeleton = () => {
			pvBody.textContent = "";
			const wrap = el("div", "padding:20px;display:flex;flex-direction:column;gap:14px;");
			const bar = (w, h) => el("div", "height:" + (h || 14) + "px;width:" + w + ";border-radius:4px;background:" + hoverBg + ";");
			const top = el("div", "display:flex;gap:12px;align-items:center;");
			top.append(el("div", "width:48px;height:48px;border-radius:50%;background:" + hoverBg + ";"), el("div", "flex:1;display:flex;flex-direction:column;gap:8px;"));
			top.lastChild.append(bar("30%"), bar("80%", 20));
			wrap.append(top);
			[70, 55, 62, 48, 66, 40].forEach((w) => wrap.append(bar(w + "%")));
			wrap.setAttribute("aria-busy", "true");
			wrap.setAttribute("aria-label", "Loading ticket");
			pvBody.append(wrap);
		};
		const errorState = (name, message) => {
			pvBody.textContent = "";
			const box = el("div", "padding:40px 24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;");
			const ic = icn(PV_ICON.alert, 48);
			ic.style.cssText += "border-radius:50%;background:" + BADGE.red[0] + ";color:" + BADGE.red[2] + ";";
			const retry = btnSecondary("Retry");
			retry.addEventListener("click", () => openPreview(name));
			box.append(
				ic,
				el("div", "font:600 16px/24px " + T.font + ";color:" + T.text900 + ";", "Could not load #" + name),
				el("div", "font:400 14px/20px " + T.font + ";color:" + T.text500 + ";max-width:300px;", message),
				retry
			);
			box.setAttribute("role", "alert");
			pvBody.append(box);
		};

		// Sections (collapsible, open by default) — header in the Figma Side Menu item style.
		const section = (key, title, action, fill) => {
			const s = el("section", "border-top:1px solid " + T.divider + ";padding:12px 12px 20px;");
			const head = el("div", "display:flex;align-items:center;gap:8px;");
			const toggle = el(
				"button",
				"flex:1;display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:4px;background:none;cursor:pointer;text-align:left;" +
					"font:600 16px/24px " + T.font + ";color:" + T.text900 + ";"
			);
			toggle.type = "button";
			const chev = icn(PV_ICON.chevron);
			chev.style.color = T.text500;
			chev.style.transition = reduceMotion ? "" : "transform 150ms";
			toggle.append(chev, el("span", null, title));
			toggle.addEventListener("mouseenter", () => (toggle.style.background = hoverBg));
			toggle.addEventListener("mouseleave", () => (toggle.style.background = "none"));
			head.append(toggle);
			if (action) head.append(action);
			const body = el("div", "padding:8px 8px 0 12px;display:flex;flex-direction:column;gap:20px;");
			const id = "yool-pv-sec-" + key;
			body.id = id;
			toggle.setAttribute("aria-controls", id);
			const apply = () => {
				const open = PV.open[key] !== false;
				body.hidden = !open;
				body.style.display = open ? "flex" : "none"; // the inline display:flex would override [hidden]
				toggle.setAttribute("aria-expanded", String(open));
				chev.style.transform = open ? "none" : "rotate(-90deg)";
			};
			toggle.addEventListener("click", () => {
				PV.open[key] = PV.open[key] === false;
				apply();
			});
			fill(body);
			apply();
			s.append(head, body);
			return s;
		};
		// "Actions ▾" on the first section (as on the HubSpot record panel).
		const sectionActions = (d) => {
			const b = btnText("Actions", PV_ICON.chevron);
			b.style.height = "32px";
			b.style.padding = "6px 8px";
			b.addEventListener("click", (e) => {
				e.stopPropagation();
				showMenu2(b, [
					{ label: "Open ticket", icon: PV_ICON.arrow, onClick: () => goTicket(d.name) },
					{ label: "Open in new tab", icon: PV_ICON.external, onClick: () => openNewTab(d.name) },
					{ label: "Copy link", icon: PV_ICON.link, onClick: () => copyLink(d.name) },
				]);
			});
			return b;
		};
		const smallLink = (text, onClick) => {
			const a = btnLink(text);
			a.href = "#";
			a.style.fontSize = "14px";
			a.style.padding = "0 8px";
			a.addEventListener("click", (e) => {
				e.preventDefault();
				onClick();
			});
			return a;
		};
		// "Ticket type" value: every type, primary first ("Printer Issue + Network Issue"), plus "Edit" when
		// the user may write (re-opens the picker with the current types pre-checked).
		const typesValue = (d) => {
			const list = (d.ticket_types && d.ticket_types.length ? d.ticket_types : [d.ticket_type]).filter((x) => x && x !== "Unspecified");
			const text = list.join(" + ") || d.ticket_type || "";
			if (!d.can_write) return text;
			const w = el("span", "display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:0 4px;");
			w.append(text ? el("span", null, text) : muted());
			const edit = smallLink("Beddel / Edit", () => runAction("Ticket type change", () => editTicketTypes(d.name)));
			edit.dataset.yoolEditTypes = "1";
			w.append(edit);
			return w;
		};
		// "About" rows: label above value, "--" when empty (as in the screenshot).
		const pvField = (label, value) => {
			const f = el("div", "display:flex;flex-direction:column;gap:4px;min-width:0;");
			f.append(el("div", "font:500 12px/18px " + T.font + ";color:" + T.text500 + ";", label));
			const v = el("div", "font:500 14px/20px " + T.font + ";color:" + T.text900 + ";min-width:0;overflow-wrap:anywhere;");
			if (value == null || value === "") v.append(muted());
			else if (typeof value === "string") v.textContent = value;
			else v.append(value);
			f.append(v);
			return f;
		};
		const slaInfo = (d) => {
			const s = d.sla || {};
			const due = !s.first_responded_on ? s.response_by : s.resolution_by;
			if (s.status === "Failed") return ["Failed", "red", due ? "was due " + fmtDate(due, true) : ""];
			if (s.status === "Fulfilled") return ["Fulfilled", "green", s.resolution_date ? "resolved " + fmtDate(s.resolution_date, true) : ""];
			if (s.on_hold_since || d.status_category === "Paused") return ["Paused", "gray", s.on_hold_since ? "since " + fmtDate(s.on_hold_since, true) : ""];
			if (!due) return null;
			const ms = parseTs(due).getTime() - Date.now();
			return ms < 0 ? ["Overdue", "red", "due " + fmtDate(due, true)] : ["On track", "yellow", "due " + fmtDate(due, true)];
		};

		// Actions (only what the user may do: can_write from the server).
		const PRIORITY_COLORS = PRIORITY_DOT;
		const runAction = async (label, fn) => {
			try {
				await fn();
				await refreshPreview();
			} catch (e) {
				toast(label + " failed: " + e.message);
				await refreshPreview().catch(() => {});
			}
		};
		const setStatus = (to) =>
			runAction("Status change", async () => {
				const d = PV.data;
				const f = findTicket(d.name);
				if (f) await moveTicket(d.name, f.status, to);
				else {
					// Card not on the board (filtered out): same ticket-type guard as drag & drop.
					if (!(await ensureTicketType(d.name, to))) return; // cancelled: nothing changes
					const set = () => api("frappe.client.set_value", { doctype: "HD Ticket", name: String(d.name), fieldname: "status", value: to }, true);
					try {
						await set();
					} catch (e) {
						if (!TYPE_GUARD_RE.test(e.message || "")) throw e;
						if (await ensureTicketType(d.name, to)) await set();
					}
				}
			});
		const setPriority = (p) =>
			runAction("Priority change", async () => {
				const d = PV.data;
				await api("frappe.client.set_value", { doctype: "HD Ticket", name: String(d.name), fieldname: "priority", value: p }, true);
				const f = findTicket(d.name);
				if (f) {
					f.t.priority = p;
					render();
				}
			});
		const assignTo = (user) =>
			runAction("Assignment", async () => {
				const d = PV.data;
				const current = (d.assigned || []).map((a) => a.user);
				if (!(current.length === 1 && current[0] === user)) {
					if (!current.includes(user))
						await api("frappe.desk.form.assign_to.add", { doctype: "HD Ticket", name: String(d.name), assign_to: JSON.stringify([user]) }, true);
					for (const u of current)
						if (u !== user) await api("frappe.desk.form.assign_to.remove", { doctype: "HD Ticket", name: String(d.name), assign_to: u }, true);
				}
			});
		const statusMenu = (anchor) =>
			showMenu2(
				anchor,
				ordered().map((s) => ({
					label: colLabel(s),
					selected: s.name === PV.data.status,
					lead: () => {
						const b = el("span", "width:24px;display:flex;align-items:center;justify-content:center;");
						b.append(el("span", "width:10px;height:10px;border-radius:50%;background:" + colColor(s) + ";"));
						return b;
					},
					onClick: () => s.name !== PV.data.status && setStatus(s.name),
				}))
			);
		const priorityMenu = (anchor) =>
			showMenu2(
				anchor,
				priorities.map((p) => ({
					label: p.name,
					selected: p.name === PV.data.priority,
					lead: () => {
						const b = el("span", "width:24px;display:flex;align-items:center;justify-content:center;");
						b.append(el("span", "width:10px;height:10px;border-radius:50%;background:" + (PRIORITY_COLORS[p.name] || T.text300) + ";"));
						return b;
					},
					onClick: () => p.name !== PV.data.priority && setPriority(p.name),
				}))
			);
		const assignMenu = (anchor) => {
			const current = (PV.data.assigned || []).map((a) => a.user);
			showMenu2(
				anchor,
				agents.map((a) => ({
					label: a.agent_name || a.name,
					selected: current.includes(a.name),
					lead: () => avatarOf(a.agent_name || a.name, a.user_image, 24),
					onClick: () => assignTo(a.name),
				}))
			);
		};
		pvActions.addEventListener("click", (e) => {
			e.stopPropagation();
			const d = PV.data;
			if (!d) return;
			const items = [];
			if (d.can_write) {
				items.push({ label: "Assign", icon: PV_ICON.assign, onClick: () => assignMenu(pvActions) });
				items.push({ label: "Change status", icon: PV_ICON.status, onClick: () => statusMenu(pvActions) });
				items.push({ label: "Change priority", icon: PV_ICON.flag, onClick: () => priorityMenu(pvActions) });
			}
			items.push({ label: "Copy link", icon: PV_ICON.link, onClick: () => copyLink(d.name) });
			items.push({ label: "Open in new tab", icon: PV_ICON.external, onClick: () => openNewTab(d.name) });
			showMenu2(pvActions, items.concat(deleteItem(d.name, d.subject)));
		});

		// Comment composer (Figma input + Primary / Secondary gray buttons).
		const composer = () => {
			const box = el("div", "display:flex;flex-direction:column;gap:8px;");
			const ta = el(
				"textarea",
				"width:100%;min-height:88px;box-sizing:border-box;padding:8px 12px;border:1px solid " + T.border + ";border-radius:8px;resize:vertical;" +
					"background:" + T.surface + ";color:" + T.text900 + ";font:500 14px/20px " + T.font + ";outline:none;"
			);
			ta.placeholder = "Add an internal comment…";
			ta.setAttribute("aria-label", "Internal comment");
			ta.addEventListener("focus", () => {
				ta.style.borderColor = "#6ee8c3";
				ta.style.boxShadow = "0 0 0 4px rgba(29,180,135,0.2)";
			});
			ta.addEventListener("blur", () => {
				ta.style.borderColor = T.border;
				ta.style.boxShadow = "";
			});
			const row = el("div", "display:flex;justify-content:flex-end;gap:8px;");
			const cancel = btnSecondary("Cancel");
			const save = btnPrimary("Add comment");
			cancel.addEventListener("click", () => {
				PV.composing = false;
				box.remove();
			});
			save.addEventListener("click", async () => {
				const text = ta.value.trim();
				if (!text) return ta.focus();
				save.disabled = true;
				const html = "<p>" + text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") + "</p>";
				try {
					await api(
						"frappe.client.insert",
						{ doc: { doctype: "HD Ticket Comment", reference_ticket: PV.data.name, commented_by: me && me.user_id, content: html } },
						true
					);
					PV.composing = false;
					toast("Comment added to #" + PV.data.name, true);
					await refreshPreview();
				} catch (e) {
					save.disabled = false;
					toast("Comment failed: " + e.message);
				}
			});
			row.append(cancel, save);
			box.append(ta, row);
			setTimeout(() => ta.focus(), 0);
			return box;
		};

		const drawPreview = (d) => {
			const scrollTop = pvBody.scrollTop;
			pvBody.textContent = "";
			pvTitle.textContent = "Preview";
			pvActions.style.visibility = "visible";

			// Summary block.
			const sum = el("div", "padding:20px;display:flex;flex-direction:column;gap:16px;");
			const id = el("div", "display:flex;align-items:center;gap:12px;");
			const circle = icn(PV_ICON.ticket, 48);
			circle.style.cssText += "border-radius:50%;background:" + hoverBg + ";color:" + T.text900 + ";";
			const names = el("div", "display:flex;flex-direction:column;gap:2px;min-width:0;");
			names.append(
				el("div", "font:500 14px/20px " + T.font + ";color:" + T.text300 + ";", "#" + d.name),
				el("div", "font:600 24px/32px " + T.font + ";color:" + T.text900 + ";overflow-wrap:anywhere;", d.subject || "(no subject)")
			);
			id.append(circle, names);
			sum.append(id);

			const rows = el("div", "display:flex;flex-direction:column;gap:8px;padding-left:60px;");
			const row = (label, value) => {
				const r = el("div", "display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-width:0;font:500 14px/20px " + T.font + ";color:" + T.text900 + ";");
				r.append(el("span", "color:" + T.text500 + ";", label + ":"));
				if (value == null || value === "") r.append(muted());
				else if (typeof value === "string") r.append(el("span", null, value));
				else [].concat(value).forEach((x) => x && r.append(x));
				rows.append(r);
			};
			const st = statuses.find((x) => x.name === d.status);
			row("Status", d.status ? pillDot(st ? colLabel(st) : d.status, statusColor(d.status)) : null);
			row("Priority", d.priority ? pillDot(d.priority, PRIORITY_COLORS[d.priority] || T.text300) : null);
			const sla = slaInfo(d);
			row("SLA", sla ? [badge(sla[1], sla[0]), sla[2] ? el("span", "font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", sla[2]) : null] : null);
			if (d.customer) {
				const co = btnLink(d.customer_name || d.customer);
				co.href = "/app/customer/" + encodeURIComponent(d.customer);
				co.target = "_blank";
				co.rel = "noopener";
				row("Company", co);
			} else row("Company", null);
			row(
				"Assigned to",
				(d.assigned || []).length
					? d.assigned.map((a) => {
							const w = el("span", "display:inline-flex;align-items:center;gap:6px;");
							// Same name as on the card (HD Agent name), falling back to the user's full name.
							const nm = (agentNames[a.user] || {}).agent_name || a.name;
							w.append(avatarOf(nm, a.image, 24), el("span", null, nm));
							return w;
					  })
					: el("span", "color:" + T.text300 + ";", "Unassigned")
			);
			row("Opened", [el("span", null, fmtDate(d.opened)), el("span", "color:" + T.text300 + ";", "· " + ago(d.opened))]);
			sum.append(rows);

			// Quick actions: round icon buttons with labels under them.
			const qa = el("div", "display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:8px 0 4px;");
			const quick = (label, svg, onClick) => {
				const w = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;width:56px;");
				const b = el(
					"button",
					"width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;" +
						"border:1px solid " + T.border + ";background:" + T.surface + ";color:" + T.text900 + ";"
				);
				b.type = "button";
				b.setAttribute("aria-label", label);
				b.append(icn(svg));
				b.addEventListener("mouseenter", () => (b.style.background = hoverBg));
				b.addEventListener("mouseleave", () => (b.style.background = T.surface));
				b.addEventListener("click", (e) => {
					e.stopPropagation();
					onClick(b);
				});
				b.setOpen = (on) => (b.style.borderColor = on ? openBorder : T.border);
				w.append(b, el("span", "font:500 12px/18px " + T.font + ";color:" + T.text500 + ";", label));
				qa.append(w);
			};
			quick("Reply", PV_ICON.reply, () => goTicket(d.name));
			if (d.can_write) {
				quick("Comment", PV_ICON.comment, () => {
					PV.open.conversation = true;
					PV.composing = true;
					drawPreview(PV.data);
				});
				quick("Assign", PV_ICON.assign, (b) => assignMenu(b));
				quick("Status", PV_ICON.status, (b) => statusMenu(b));
			}
			quick("More", PV_ICON.more, (b) =>
				showMenu2(
					b,
					[]
						.concat(d.can_write ? [{ label: "Change priority", icon: PV_ICON.flag, onClick: () => priorityMenu(b) }] : [])
						.concat([
							{ label: "Copy link", icon: PV_ICON.link, onClick: () => copyLink(d.name) },
							{ label: "Open in new tab", icon: PV_ICON.external, onClick: () => openNewTab(d.name) },
						])
						.concat(deleteItem(d.name, d.subject))
				)
			);
			sum.append(qa);
			pvBody.append(sum);

			// 1. Details
			pvBody.append(
				section("details", "About this ticket", sectionActions(d), (b) => {
					b.append(
						pvField("Ticket type", typesValue(d)),
						pvField("Team", d.team),
						pvField("Ka yimid", d.source_team ? d.source_team + " team" : ""),
						pvField("Channel", d.channel),
						pvField("Customer contact", d.primary_contact || d.contact),
						pvField("Caller", [d.caller_name, d.caller_phone].filter(Boolean).join(" · "))
					);
				})
			);
			// 2. SLA
			pvBody.append(
				section("sla", "SLA", null, (b) => {
					const s = d.sla || {};
					b.append(
						pvField("Policy", s.name),
						pvField("First response due", fmtDate(s.response_by, true)),
						pvField("First response at", fmtDate(s.first_responded_on, true)),
						pvField("Resolution due", fmtDate(s.resolution_by, true)),
						pvField("Resolved at", fmtDate(s.resolution_date, true))
					);
				})
			);
			// 3. Latest conversation
			pvBody.append(
				section("conversation", "Latest conversation", smallLink("View all", () => goTicket(d.name)), (b) => {
					if (PV.composing) b.append(composer());
					if (!(d.conversation || []).length) b.append(muted("No messages yet"));
					(d.conversation || []).forEach((m) => {
						const item = el("div", "display:flex;gap:10px;min-width:0;");
						const text = el("div", "display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;");
						const top = el("div", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
						top.append(el("span", "font:600 14px/20px " + T.font + ";color:" + T.text900 + ";", m.sender_name || m.sender || "Unknown"));
						if (m.kind === "comment") top.append(badge("gray", "Comment"));
						else if (m.incoming) top.append(badge("blue", "Customer"));
						top.append(el("span", "font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", ago(m.at)));
						text.append(
							top,
							el(
								"div",
								"font:400 14px/20px " + T.font + ";color:" + T.text500 + ";display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;",
								m.text || "(no text)"
							)
						);
						item.append(avatarOf(m.sender_name || m.sender, m.image, 32), text);
						b.append(item);
					});
				})
			);
			// 4. Activity
			pvBody.append(
				section("activity", "Activity", null, (b) => {
					if (!(d.activity || []).length) b.append(muted("No activity yet"));
					(d.activity || []).forEach((a) => {
						const item = el("div", "display:flex;gap:10px;align-items:flex-start;");
						item.append(el("span", "width:8px;height:8px;margin-top:6px;border-radius:50%;flex:0 0 auto;background:" + T.border + ";"));
						const t = el("div", "display:flex;flex-direction:column;min-width:0;");
						t.append(
							el("div", "font:500 14px/20px " + T.font + ";color:" + T.text900 + ";overflow-wrap:anywhere;", (a.by || "Someone") + " " + (a.action || "")),
							el("div", "font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", fmtDate(a.at, true) + " · " + ago(a.at))
						);
						item.append(t);
						b.append(item);
					});
				})
			);
			pvBody.scrollTop = scrollTop;
		};

		// Keep the card on the board in step with the panel (own changes and changes from others).
		const syncCard = (d) => {
			const f = findTicket(d.name);
			if (!f) return;
			const t = f.t;
			const users = (d.assigned || []).map((a) => a.user);
			Object.assign(t, { priority: d.priority, _assign: JSON.stringify(users), agreement_status: (d.sla || {}).status });
			if (d.status !== f.status) {
				const src = columns[f.status];
				src.tickets.splice(f.index, 1);
				src.count -= 1;
				t.status = d.status;
				const dst = columns[d.status];
				if (dst) {
					dst.tickets.unshift(t);
					dst.count += 1;
				}
			}
			render();
		};
		const fetchPreview = (name, check) => api("yool_ticket_preview", check ? { ticket: String(name), check: "1" } : { ticket: String(name) });
		const refreshPreview = async () => {
			if (!PV.name) return;
			const name = PV.name;
			const my = ++PV.seq;
			const d = await fetchPreview(name);
			if (my !== PV.seq || PV.name !== name) return;
			PV.data = d;
			drawPreview(d);
			syncCard(d);
		};
		const poll = async () => {
			if (!document.body.contains(pvPanel)) return clearInterval(PV.timer);
			if (!PV.name || !PV.data || document.visibilityState !== "visible" || PV.composing) return;
			const c = await fetchPreview(PV.name, true).catch(() => null);
			if (c && PV.data && c.modified !== PV.data.modified) refreshPreview().catch(() => {});
		};

		const openPreview = async (name, fromEl, keepFocus) => {
			name = String(name);
			closePop();
			const wasOpen = !!PV.name;
			if (PV.name && PV.name !== name) highlight(PV.name, false);
			if (!wasOpen) PV.returnFocus = fromEl || document.activeElement;
			PV.name = name;
			PV.data = null;
			PV.composing = false;
			highlight(name, true);
			setUrl(name);
			pvPanel.style.visibility = "visible";
			layoutPanel();
			pvActions.style.visibility = "hidden";
			skeleton();
			if (!keepFocus) setTimeout(() => pvClose.focus(), reduceMotion ? 0 : 200);
			setTimeout(() => cardEls[name] && cardEls[name].scrollIntoView({ block: "nearest", inline: "nearest" }), reduceMotion ? 0 : 220);
			clearInterval(PV.timer);
			PV.timer = setInterval(poll, 20000);
			const my = ++PV.seq;
			try {
				const d = await fetchPreview(name);
				if (my !== PV.seq || PV.name !== name) return;
				PV.data = d;
				drawPreview(d);
			} catch (e) {
				if (my !== PV.seq || PV.name !== name) return;
				errorState(name, e.message);
			}
		};
		const closePreview = (navigating) => {
			if (!PV.name) return;
			const name = PV.name;
			highlight(name, false);
			PV.name = null;
			PV.data = null;
			PV.seq++;
			clearInterval(PV.timer);
			closePop();
			layoutPanel();
			setTimeout(() => !PV.name && (pvPanel.style.visibility = "hidden"), reduceMotion ? 0 : 200);
			if (!navigating) {
				setUrl(null);
				const back = cardEls[name] || PV.returnFocus;
				if (back && document.body.contains(back)) back.focus();
			}
		};
		// Esc closes; Arrow Up / Down move within the same column. Capture phase, so an open dropdown
		// (closed by its own Escape handler) keeps the panel open.
		document.addEventListener(
			"keydown",
			(e) => {
				if (!PV.name || !document.body.contains(pvPanel) || openPop) return;
				const tag = (e.target.tagName || "").toLowerCase();
				if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
				if (e.key === "Escape") {
					e.preventDefault();
					closePreview();
				} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
					const f = findTicket(PV.name);
					if (!f) return;
					const next = columns[f.status].tickets[f.index + (e.key === "ArrowDown" ? 1 : -1)];
					if (!next) return;
					e.preventDefault();
					openPreview(next.name, null, true);
					const c = cardEls[next.name];
					if (c) c.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
				}
			},
			true
		);
		layoutPanel();

		// Delete (managers / admins only): a confirmation dialog first, then frappe.client.delete.
		const deleteItem = (name, subject) =>
			canEdit ? [{ label: "Delete ticket", icon: PV_ICON.trash, danger: true, onClick: () => confirmDelete(name, subject) }] : [];
		const confirmDelete = (name, subject) => {
			const returnFocus = document.activeElement;
			const overlay = el("div", "position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,10,14,0.4);font-family:" + T.font + ";");
			overlay.dataset.yoolPop = "1";
			const card = el(
				"div",
				"width:min(440px,100%);box-sizing:border-box;padding:24px;border-radius:12px;border:1px solid " + T.divider + ";background:" + T.surface + ";" +
					"color:" + T.text900 + ";box-shadow:0 24px 48px -12px rgba(16,24,32,0.18);display:flex;flex-direction:column;gap:16px;"
			);
			card.setAttribute("role", "alertdialog");
			card.setAttribute("aria-modal", "true");
			card.setAttribute("aria-labelledby", "yool-del-title");
			const badge = el("span", "display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;color:#d92d20;background:" + (dark ? "rgba(217,45,32,0.16)" : "#fee4e2") + ";box-shadow:0 0 0 8px " + (dark ? "rgba(217,45,32,0.08)" : "#fef3f2") + ";");
			badge.innerHTML = PV_ICON.trash;
			const title = el("div", "font:600 18px/28px " + T.font + ";", "Delete ticket #" + name + "?");
			title.id = "yool-del-title";
			const text = el("div", "font:400 14px/20px " + T.font + ";color:" + T.text500 + ";");
			text.append(
				el("div", "font-weight:500;color:" + T.text900 + ";margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", subject || ""),
				el("div", null, "The ticket and its replies, comments and activity are removed. Only an administrator can restore it.")
			);
			const btns = el("div", "display:flex;justify-content:flex-end;gap:12px;margin-top:8px;");
			const cancel = btnSecondary("Cancel");
			const del = btnPrimary("Delete");
			del.style.background = "#d92d20";
			del.addEventListener("mouseenter", () => (del.style.background = "#b42318"));
			del.addEventListener("mouseleave", () => (del.style.background = "#d92d20"));
			btns.append(cancel, del);
			card.append(badge, el("div", "display:flex;flex-direction:column;gap:4px;"), btns);
			card.children[1].append(title, text);
			overlay.append(card);
			document.body.append(overlay);
			cancel.focus(); // the safe choice has focus
			const close = () => {
				overlay.remove();
				document.removeEventListener("keydown", onKey, true);
				if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
			};
			const onKey = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					close();
				} else if (e.key === "Tab") {
					e.preventDefault();
					(document.activeElement === cancel ? del : cancel).focus();
				} else e.stopPropagation();
			};
			document.addEventListener("keydown", onKey, true);
			overlay.addEventListener("mousedown", (e) => e.target === overlay && close());
			cancel.addEventListener("click", close);
			del.addEventListener("click", async () => {
				del.disabled = cancel.disabled = true;
				del.textContent = "Deleting…";
				try {
					await api("frappe.client.delete", { doctype: "HD Ticket", name: String(name) }, true);
					close();
					if (PV.name === String(name)) closePreview();
					toast("Ticket #" + name + " deleted", true);
					loadAll();
				} catch (e) {
					toast("Could not delete #" + name + ": " + e.message, false);
					close();
				}
			});
		};

		// Card menu (⋮): Preview, Open in new tab, Copy link.
		const cardMenuButton = (t, c) => {
			const b = el(
				"button",
				"display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:4px;box-sizing:border-box;flex:0 0 auto;" +
					"border:1px solid " + T.border + ";border-radius:4px;background:" + T.surface + ";color:" + T.text500 + ";cursor:pointer;" +
					"opacity:" + (touch ? 1 : 0) + ";transition:opacity 120ms ease;"
			);
			b.type = "button";
			b.setAttribute("aria-label", "Ticket #" + t.name + " actions");
			b.setAttribute("aria-haspopup", "menu");
			b.append(icn(PV_ICON.kebab));
			b.setOpen = (on) => {
				b.style.borderColor = on ? openBorder : T.border;
				b.style.opacity = on || touch ? "1" : b.style.opacity;
			};
			b.addEventListener("click", (e) => {
				e.stopPropagation();
				showMenu2(b, [
					{ label: "Preview", icon: PV_ICON.eye, onClick: () => openPreview(t.name, c) },
					{ label: "Open in new tab", icon: PV_ICON.external, onClick: () => openNewTab(t.name) },
					{ label: "Copy link", icon: PV_ICON.link, onClick: () => copyLink(t.name) },
				].concat(deleteItem(t.name, t.subject)));
			});
			b.addEventListener("mousedown", (e) => e.stopPropagation());
			b.draggable = false;
			if (!touch) {
				c.addEventListener("mouseenter", () => (b.style.opacity = "1"));
				c.addEventListener("mouseleave", () => !(openPop && openPop.trigger === b) && c !== document.activeElement && !c.contains(document.activeElement) && (b.style.opacity = "0"));
				c.addEventListener("focusin", () => (b.style.opacity = "1"));
				c.addEventListener("focusout", (e) => !c.contains(e.relatedTarget) && (b.style.opacity = "0"));
			}
			return b;
		};

		// ---------- column collapse (per user) ----------
		const STRIP = 40;
		// Columns pinned for this page view only (after a drop), so counts changing don't flip them.
		const sessionPins = {};
		const isCollapsed = (s) => {
			if (layout.collapsed[s.name] != null) return !!layout.collapsed[s.name];
			if (sessionPins[s.name] != null) return sessionPins[s.name];
			// Never toggled by this user: closed-type and empty columns start collapsed.
			const data = columns[s.name];
			return s.category === "Resolved" || !data || !data.count;
		};
		const visibleColumns = () => ordered().filter((s) => !colSettings(s).hidden);
		const setCollapsed = (names, value) => {
			names.forEach((n) => (layout.collapsed[n] = value));
			saveLayout();
		};
		const toggleColumn = (s, node) => {
			const value = !isCollapsed(s);
			setCollapsed([s.name], value);
			if (!node) return render();
			// ~200ms width animation, then redraw the column in its new form.
			node.style.transition = "flex-basis 200ms ease, min-width 200ms ease, max-width 200ms ease";
			node.style.overflow = "hidden";
			requestAnimationFrame(() => {
				node.style.flexBasis = (value ? STRIP : 260) + "px";
				node.style.minWidth = (value ? STRIP : 210) + "px";
				node.style.maxWidth = (value ? STRIP : 340) + "px";
			});
			setTimeout(render, 210);
		};

		// Customer WhatsApp texts per status (Chatwoot tickets only): one column from its ⋮ menu, or every column at once
		// from the header. Stored in Chatwoot Settings through the chatwoot_message_templates server script.
		const MSG_SAMPLE = { name: "Customer", ticket: "1243", subject: "Printer issue" };
		const fillMsg = (tpl, status) =>
			String(tpl || "")
				.split("{name}").join(MSG_SAMPLE.name)
				.split("{ticket}").join(MSG_SAMPLE.ticket)
				.split("{subject}").join(MSG_SAMPLE.subject)
				.split("{status}").join(status);
		const switchEl = (on, label) => {
			const b = el("button", "position:relative;width:32px;height:18px;flex:0 0 auto;border:0;padding:0;border-radius:10px;cursor:pointer;transition:background 150ms;");
			b.type = "button";
			b.setAttribute("role", "switch");
			b.setAttribute("aria-label", label);
			const knob = el("span", "position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:0 1px 2px rgba(16,24,32,0.2);transition:left 150ms;");
			b.append(knob);
			const paint = () => {
				b.setAttribute("aria-checked", String(b.on));
				b.style.background = b.on ? T.brand : T.toggleOff;
				knob.style.left = b.on ? "16px" : "2px";
			};
			b.on = !!on;
			b.addEventListener("click", () => {
				b.on = !b.on;
				paint();
				b.dispatchEvent(new Event("change"));
			});
			paint();
			return b;
		};
		// Managers only: Sales-alert team numbers (Chatwoot Settings sales_alert_tech_phone / sales_alert_sales_phone).
		// Read + saved through chatwoot_message_templates (action get / team_numbers); the server normalizes and validates
		// (Server Script "Chatwoot Settings Team Numbers") and returns numbers to managers only.
		const openTeamNumbers = async () => {
			if (!canEdit) return toast("Only managers can change the team numbers.", false);
			let data;
			try {
				// POST + with_inboxes: the server lists the Chatwoot inboxes (one test_connection Sync Log row).
				data = ((await api("chatwoot_message_templates", { action: "get", payload: { with_inboxes: 1 } }, true)) || {}).templates || {};
			} catch (e) {
				return toast("Could not load the team numbers: " + e.message, false);
			}
			const nums = data.team_numbers || {};
			const returnFocus = document.activeElement;
			const overlay = el("div", "position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,10,14,0.4);font-family:" + T.font + ";");
			overlay.dataset.yoolPop = "1";
			overlay.dataset.yoolTeamNumbers = "1";
			const box = el(
				"div",
				"width:min(460px,100%);box-sizing:border-box;padding:24px;border-radius:0;border:1px solid " + T.border + ";background:" + T.surface + ";" +
					"color:" + T.text900 + ";box-shadow:0 24px 48px -12px rgba(16,24,32,0.18);display:flex;flex-direction:column;gap:14px;"
			);
			box.setAttribute("role", "dialog");
			box.setAttribute("aria-modal", "true");
			box.setAttribute("aria-labelledby", "yool-tn-title");
			const title = el("div", "font:600 16px/24px " + T.font + ";", "⚙ Team numbers / Numbarrada kooxaha");
			title.id = "yool-tn-title";
			const intro = el(
				"div",
				"font:500 13px/20px " + T.font + ";color:" + T.text500 + ";",
				"Ticket cusub oo Sales ka yimid wuxuu WhatsApp u diraa numberka Technical; numberka Sales waxaa lagu qoraa fariinta. / " +
					"A new Sales ticket WhatsApps the Technical number; the Sales number is shown in that message."
			);
			const input = (value, ph) => {
				const i = el(
					"input",
					"height:40px;padding:8px 12px;box-sizing:border-box;border-radius:0;border:1px solid " + T.border + ";background:" + T.surface + ";" +
						"color:" + T.text900 + ";font:500 14px/20px " + T.font + ";outline:none;width:100%;"
				);
				i.type = "tel";
				i.value = value || "";
				i.placeholder = ph;
				i.addEventListener("focus", () => (i.style.borderColor = T.brand));
				i.addEventListener("blur", () => (i.style.borderColor = T.border));
				return i;
			};
			const fld = (label, help, control) => {
				const f = el("label", "display:flex;flex-direction:column;gap:6px;");
				f.append(el("span", "font:600 14px/20px " + T.font + ";color:" + T.text900 + ";", label), control, el("span", "font:500 12px/18px " + T.font + ";color:" + T.text300 + ";", help));
				return f;
			};
			const tech = input(nums.tech_phone, "+2526XXXXXXXX");
			tech.dataset.yoolTn = "tech";
			const sales = input(nums.sales_phone, "+2526XXXXXXXX");
			sales.dataset.yoolTn = "sales";
			// Sales inbox: a select of the Chatwoot inboxes when the list loaded, else a plain number field.
			const ctlStyle =
				"height:40px;padding:8px 12px;box-sizing:border-box;border-radius:0;border:1px solid " + T.border + ";background:" + T.surface + ";" +
				"color:" + T.text900 + ";font:500 14px/20px " + T.font + ";outline:none;width:100%;";
			let inbox;
			if (Array.isArray(data.inboxes) && data.inboxes.length) {
				inbox = el("select", ctlStyle);
				const add = (value, label) => {
					const o = document.createElement("option");
					o.value = value;
					o.textContent = label;
					inbox.append(o);
				};
				add("", "Default" + (nums.default_inbox_id ? " (inbox " + nums.default_inbox_id + ")" : ""));
				data.inboxes.forEach((b) => add(String(b.id), "#" + b.id + " · " + (b.name || "") + (b.type ? " · " + String(b.type).replace("Channel::", "") : "")));
				const cur = nums.sales_inbox_id ? String(nums.sales_inbox_id) : "";
				if (cur && !data.inboxes.some((b) => String(b.id) === cur)) add(cur, "#" + cur + " (not found in Chatwoot)");
				inbox.value = cur;
			} else {
				inbox = el("input", ctlStyle);
				inbox.type = "number";
				inbox.min = "1";
				inbox.value = nums.sales_inbox_id ? String(nums.sales_inbox_id) : "";
				inbox.placeholder = "Default" + (nums.default_inbox_id ? " (" + nums.default_inbox_id + ")" : "");
			}
			inbox.dataset.yoolTn = "inbox";
			inbox.addEventListener("focus", () => (inbox.style.borderColor = T.brand));
			inbox.addEventListener("blur", () => (inbox.style.borderColor = T.border));
			const err = el("div", "display:none;font:500 13px/20px " + T.font + ";color:#b42318;");
			const btns = el("div", "display:flex;justify-content:flex-end;gap:12px;margin-top:4px;");
			const cancel = btnSecondary("Cancel");
			const ok = btnPrimary("Save");
			cancel.style.borderRadius = ok.style.borderRadius = "0";
			btns.append(cancel, ok);
			box.append(
				title,
				intro,
				fld("Numberka Kooxda Technical (WhatsApp)", "Wuxuu helaa digniinta Sales / Receives the Sales alert. Bannaan = digniin lama diro / Empty = no alert.", tech),
				fld("Numberka Kooxda Sales", "Waxaa lagu qoraa fariinta / Shown in the alert text.", sales),
				fld("Inbox-ka Sales (Chatwoot)", "Digniinta waxaa laga diraa inbox-kan (numberka WhatsApp ee Sales) / The alert is sent FROM this inbox. Default = inbox-ka caadiga.", inbox),
				err,
				btns
			);
			overlay.append(box);
			document.body.append(overlay);
			tech.focus();
			const close = () => {
				overlay.remove();
				document.removeEventListener("keydown", onKey, true);
				if (returnFocus && returnFocus.focus) returnFocus.focus();
			};
			const onKey = (e) => {
				if (e.key === "Escape") {
					e.stopPropagation();
					close();
				} else if (e.key === "Enter" && (e.target === tech || e.target === sales)) {
					e.preventDefault();
					ok.click();
				}
			};
			document.addEventListener("keydown", onKey, true);
			overlay.addEventListener("mousedown", (e) => {
				if (e.target === overlay) close();
			});
			cancel.addEventListener("click", close);
			ok.addEventListener("click", async () => {
				ok.disabled = true;
				ok.textContent = "Saving…";
				err.style.display = "none";
				try {
					const m = await api(
						"chatwoot_message_templates",
						{ action: "team_numbers", payload: { tech_phone: tech.value.trim(), sales_phone: sales.value.trim(), sales_inbox_id: String(inbox.value || "").trim() } },
						true
					);
					const saved = ((m || {}).templates || {}).team_numbers || {};
					close();
					toast(
						"Team numbers saved / Waa la keydiyay: Technical " + (saved.tech_phone || "—") + " · Sales " + (saved.sales_phone || "—") +
							" · Inbox " + (saved.sales_inbox_id || "default"),
						true
					);
				} catch (e) {
					err.textContent = e.message;
					err.style.display = "block";
					ok.disabled = false;
					ok.textContent = "Save";
				}
			});
		};
		state.openTeamNumbers = openTeamNumbers;
		const openMsgEditor = async (list) => {
			let data;
			try {
				data = ((await api("chatwoot_message_templates", { action: "get" })) || {}).templates || {};
			} catch (e) {
				return toast("Could not load customer messages: " + e.message, false);
			}
			const global = list.length > 1;
			const rowOf = {};
			(data.rows || []).forEach((r) => (rowOf[r.status] = r));
			const returnFocus = document.activeElement;
			let lastArea = null;
			let dirty = false;

			const overlay = el("div", "position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,10,14,0.4);font-family:" + T.font + ";");
			overlay.dataset.yoolPop = "1";
			const card = el(
				"div",
				"width:min(680px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;" +
					"border-radius:12px;border:1px solid " + T.divider + ";background:" + T.surface + ";color:" + T.text900 + ";box-shadow:0 24px 48px -12px rgba(16,24,32,0.18);"
			);
			card.setAttribute("role", "dialog");
			card.setAttribute("aria-modal", "true");
			card.setAttribute("aria-labelledby", "yool-msg-title");

			const head = el("div", "display:flex;align-items:flex-start;gap:12px;padding:20px 24px 16px;border-bottom:1px solid " + T.divider + ";");
			const titles = el("div", "flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;");
			const title = el("div", "font:600 18px/28px " + T.font + ";color:" + T.text900 + ";", global ? "Customer messages" : "Customer message · " + colLabel(list[0]));
			title.id = "yool-msg-title";
			titles.append(
				title,
				el("div", "font:400 14px/20px " + T.font + ";color:" + T.text500 + ";", "WhatsApp text sent to the customer when a Chatwoot ticket moves to " + (global ? "a column." : "this column."))
			);
			const closeX = btnGhostIcon('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>', "Close");
			head.append(titles, closeX);

			const body = el("div", "flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:16px 24px;");
			if (!data.enabled || !data.send_customer_messages) {
				body.append(
					el(
						"div",
						"padding:10px 12px;border-radius:8px;background:" + (dark ? "rgba(247,144,9,0.14)" : "#fffaeb") + ";color:" + (dark ? "#fdb022" : "#b54708") + ";font:500 14px/20px " + T.font + ";",
						"Sending is off in Chatwoot Settings: texts are saved, but nothing is sent to customers."
					)
				);
			}
			// Placeholder chips insert at the caret of the last text box used.
			const chips = el("div", "display:flex;flex-wrap:wrap;align-items:center;gap:8px;");
			chips.append(el("span", "font:500 14px/20px " + T.font + ";color:" + T.text500 + ";", "Insert:"));
			(data.placeholders || ["{name}", "{ticket}", "{subject}", "{status}"]).forEach((p) => {
				const c = el(
					"button",
					"padding:2px 10px;border-radius:120px;border:1px solid " + T.border + ";background:" + T.surface + ";color:" + T.text900 + ";cursor:pointer;font:500 14px/20px " + T.font + ";",
					p
				);
				c.type = "button";
				c.addEventListener("mousedown", (e) => e.preventDefault()); // keep the caret in the text box
				c.addEventListener("click", () => {
					const a = lastArea || body.querySelector("textarea");
					if (!a) return;
					const at = a.selectionStart ?? a.value.length;
					a.value = a.value.slice(0, at) + p + a.value.slice(a.selectionEnd ?? at);
					a.focus();
					a.selectionStart = a.selectionEnd = at + p.length;
					a.dispatchEvent(new Event("input"));
				});
				chips.append(c);
			});
			body.append(chips);

			const areaStyle =
				"width:100%;min-height:84px;box-sizing:border-box;resize:vertical;padding:10px 12px;border:1px solid " + T.border + ";border-radius:8px;" +
				"background:" + T.surface + ";color:" + T.text900 + ";font:400 14px/20px " + T.font + ";outline:none;";
			const textArea = (value, placeholder) => {
				const a = focusRing(el("textarea", areaStyle));
				a.value = value || "";
				a.placeholder = placeholder || "";
				a.maxLength = 1000;
				a.addEventListener("focus", () => (lastArea = a));
				a.addEventListener("input", () => (dirty = true));
				return a;
			};
			const preview = () => el("div", "white-space:pre-wrap;padding:10px 12px;border-radius:8px;background:" + T.subtle + ";color:" + T.text500 + ";font:400 14px/20px " + T.font + ";");

			let defArea = null;
			const defaultText = () => (defArea ? defArea.value : data.default_template) || "";
			const repaints = [];
			if (global) {
				const sec = el("div", "display:flex;flex-direction:column;gap:8px;");
				sec.append(el("div", "font:600 14px/20px " + T.font + ";color:" + T.text900 + ";", "Default message"));
				sec.append(el("div", "font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", "Used by every column that has no text of its own."));
				defArea = textArea(data.default_template, "");
				defArea.addEventListener("input", () => repaints.forEach((f) => f()));
				sec.append(defArea);
				body.append(sec);
			}
			const editors = list.map((s) => {
				const r = rowOf[s.name] || { enabled: 1, message: "" };
				const box = el("div", "display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:8px;border:1px solid " + T.divider + ";");
				const top = el("div", "display:flex;align-items:center;gap:8px;");
				top.append(
					el("span", "width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:" + colColor(s) + ";"),
					el("span", "flex:1;min-width:0;font:600 14px/20px " + T.font + ";color:" + T.text900 + ";", colLabel(s))
				);
				const sendLabel = el("span", "font:500 14px/20px " + T.font + ";color:" + T.text500 + ";", "Send");
				const sw = switchEl(r.enabled, "Send a message for " + colLabel(s));
				top.append(sendLabel, sw);
				const area = textArea(r.message, "Default: " + (data.default_template || "").split("\n")[0]);
				const pv = preview();
				const paint = () => {
					area.disabled = !sw.on;
					area.style.opacity = sw.on ? "1" : "0.5";
					pv.textContent = sw.on ? fillMsg(area.value.trim() || defaultText(), s.name) : "No message is sent for this column.";
				};
				repaints.push(paint);
				area.addEventListener("input", paint);
				sw.addEventListener("change", () => {
					dirty = true;
					paint();
				});
				paint();
				box.append(top, area, el("div", "font:500 12px/18px " + T.font + ";color:" + T.text300 + ";", "Preview"), pv);
				body.append(box);
				return { s, sw, area };
			});

			const foot = el("div", "display:flex;justify-content:flex-end;gap:12px;padding:16px 24px;border-top:1px solid " + T.divider + ";");
			const cancel = btnSecondary("Cancel");
			const save = btnPrimary(data.can_edit ? "Save" : "View only");
			save.disabled = !data.can_edit;
			if (!data.can_edit) save.style.opacity = "0.5";
			foot.append(cancel, save);
			card.append(head, body, foot);
			overlay.append(card);
			document.body.append(overlay);
			(editors[0] ? editors[0].area : defArea || cancel).focus();

			const close = (force) => {
				if (!force && dirty && !window.confirm("Discard your changes?")) return;
				overlay.remove();
				document.removeEventListener("keydown", onKey, true);
				if (returnFocus && returnFocus.focus) returnFocus.focus();
			};
			const onKey = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					close();
				} else if (e.key === "Tab") {
					// Keep keyboard focus inside the dialog.
					const f = [...card.querySelectorAll("button:not([disabled]),textarea:not([disabled])")];
					if (!f.length) return;
					if (e.shiftKey && document.activeElement === f[0]) {
						e.preventDefault();
						f[f.length - 1].focus();
					} else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
						e.preventDefault();
						f[0].focus();
					}
				} else e.stopPropagation(); // typing here must not drive board shortcuts
			};
			document.addEventListener("keydown", onKey, true);
			overlay.addEventListener("mousedown", (e) => e.target === overlay && close());
			closeX.addEventListener("click", () => close());
			cancel.addEventListener("click", () => close());
			save.addEventListener("click", async () => {
				if (defArea && !defArea.value.trim()) return toast("The default message cannot be empty.", false);
				const payload = { rows: editors.map((x) => ({ status: x.s.name, enabled: x.sw.on ? 1 : 0, message: x.area.value.trim() })) };
				if (defArea) payload.default_template = defArea.value.trim();
				save.disabled = true;
				save.textContent = "Saving…";
				try {
					const saved = await api("chatwoot_message_templates", { action: "save", payload }, true);
					waInfo = (saved || {}).templates || waInfo;
					toast(global ? "Customer messages saved" : "Message saved for " + colLabel(list[0]), true);
					close(true);
				} catch (e) {
					toast("Could not save: " + e.message, false);
					save.disabled = false;
					save.textContent = "Save";
				}
			});
		};

		// Quick "New ticket" dialog (Figma modal + inputs): from the header, or a column's ＋ (status preset).
		// Saves through frappe.client.insert, so the HD Ticket rules (caller validation, Chatwoot link) all apply.
		const openNewTicket = (presetStatus, opts) => {
			// opts.asUser: preview another user's defaults (testing only — Create stays disabled).
			const asUser = (opts && opts.asUser) || "";
			const def = newTicketDefaults(asUser || myId);
			const returnFocus = document.activeElement;
			const overlay = el("div", "position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,10,14,0.4);font-family:" + T.font + ";");
			overlay.dataset.yoolPop = "1";
			const card = el(
				"div",
				"width:min(640px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;" +
					"border-radius:12px;border:1px solid " + T.divider + ";background:" + T.surface + ";color:" + T.text900 + ";box-shadow:0 24px 48px -12px rgba(16,24,32,0.18);"
			);
			card.setAttribute("role", "dialog");
			card.setAttribute("aria-modal", "true");
			card.setAttribute("aria-labelledby", "yool-nt-title");

			const head = el("div", "display:flex;align-items:flex-start;gap:12px;padding:20px 24px 16px;border-bottom:1px solid " + T.divider + ";");
			const badge = el("span", "display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex:0 0 auto;border-radius:10px;background:" + T.brandSoftBg + ";color:" + T.brandSoftText + ";");
			badge.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M12 9v6M9 12h6"/></svg>';
			const titles = el("div", "flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;");
			const title = el("div", "font:600 18px/28px " + T.font + ";", "New ticket");
			title.id = "yool-nt-title";
			titles.append(title, el("div", "font:400 14px/20px " + T.font + ";color:" + T.text500 + ";", "Log a customer request. Fields with * are required."));
			if (asUser) title.textContent = "New ticket — preview as " + asUser;
			const closeX = btnGhostIcon('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>', "Close");
			head.append(badge, titles, closeX);

			const body = el("div", "flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:20px 24px;");
			const field = (label, control, opts) => {
				const f = el("label", "display:flex;flex-direction:column;gap:6px;min-width:0;" + (opts && opts.full ? "grid-column:1 / -1;" : ""));
				const l = el("span", "font:500 14px/20px " + T.font + ";color:" + T.text500 + ";", label);
				if (opts && opts.required) l.append(el("span", "color:#d92d20;", " *"));
				const err = el("span", "display:none;font:400 12px/18px " + T.font + ";color:#d92d20;");
				f.append(l, control);
				if (opts && opts.hint) f.append(opts.hint);
				f.append(err);
				(control.input || control).addEventListener("input", () => f.setError(""));
				f.setError = (msg) => {
					err.textContent = msg || "";
					err.style.display = msg ? "block" : "none";
					(control.input || control).style.borderColor = msg ? "#fda29b" : T.border;
				};
				body.append(f);
				return f;
			};
			const input = (placeholder, type) => {
				const i = focusRing(el("input", inputStyle + "width:100%;"));
				i.type = type || "text";
				i.placeholder = placeholder || "";
				return i;
			};

			const subject = input("e.g. Printer not printing receipts");
			subject.maxLength = 140;
			const fSubject = field("Subject", subject, { full: true, required: true });

			// Company: type to search Customers; picking one suggests the caller's phone from the primary contact.
			const coWrap = el("div", "position:relative;");
			const coIn = input("Search company…");
			coIn.setAttribute("autocomplete", "off");
			coWrap.input = coIn;
			coWrap.append(coIn);
			let company = null; // { name, customer_name }
			const coHint = el("span", "display:none;font:400 12px/18px " + T.font + ";color:" + T.text300 + ";");
			const fCompany = field("Company", coWrap, { hint: coHint });
			coIn.setOpen = () => {};
			let coSeq = 0;
			const pickCompany = async (c) => {
				company = c;
				coIn.value = c ? c.customer_name : "";
				closePop();
				coHint.style.display = "none";
				if (!c) return;
				try {
					const d = await api("yool_caller_defaults", { customer: c.name });
					if (d && d.caller_phone && !phone.value) phone.value = d.caller_phone;
					if (d && d.primary_contact_name) {
						coHint.textContent = "Primary contact: " + d.primary_contact_name;
						coHint.style.display = "block";
					}
				} catch (e) {
					/* suggestion only */
				}
			};
			coIn.addEventListener("input", () => {
				company = null;
				const q = coIn.value.trim();
				const seq = ++coSeq;
				if (q.length < 2) return closePop();
				setTimeout(async () => {
					if (seq !== coSeq) return;
					const rows = await getList("Customer", ["name", "customer_name"], [["customer_name", "like", "%" + escapeLike(q) + "%"], ["disabled", "=", 0]], { limit_page_length: 8, order_by: "customer_name asc" }).catch(() => []);
					if (seq !== coSeq) return;
					const panel = popPanel();
					panel.style.maxHeight = "280px";
					panel.style.overflowY = "auto";
					panel.style.zIndex = "1000";
					if (!rows.length) panel.append(el("div", "padding:8px 12px;font:400 14px/20px " + T.font + ";color:" + T.text300 + ";", "No company found"));
					rows.forEach((r) => {
						const row = menuRow(null, r.customer_name, false);
						row.style.font = "500 14px/20px " + T.font;
						row.addEventListener("mousedown", (e) => e.preventDefault());
						row.addEventListener("click", () => pickCompany(r));
						panel.append(row);
					});
					openPopover(coIn, panel);
				}, 200);
			});

			const prio = dropdown("Medium");
			prio.setOptions(priorities.filter((p) => p.name !== "Medium").map((p) => ({ value: p.name, label: p.name })));
			prio.style.width = "100%";
			field("Priority", prio);

			const callerName = input("Who is calling?");
			const fCaller = field("Caller name", callerName, { required: true });
			const phone = input("061 5123456", "tel");
			const fPhone = field("Caller phone", phone, { required: true });

			// Ka yimid / Raised by team (HD Ticket.source_team); defaults to the user's HD Team.
			const teamPick = dropdown("Not set");
			teamPick.setOptions([{ value: "Sales", label: "Sales" }, { value: "Technical", label: "Technical" }]);
			teamPick.value = def.team;
			teamPick.style.width = "100%";
			const teamHint = el("span", "font:400 12px/18px " + T.font + ";color:" + T.text300 + ";");
			const paintTeamHint = () =>
				(teamHint.textContent =
					teamPick.value === "Sales" ? "Kooxda Technical ayaa WhatsApp loogu diraa / Technical team gets a WhatsApp alert." : "Kooxda soo gudbisay shaqada / Team raising this work.");
			paintTeamHint();
			field("Team (Ka yimid)", teamPick, { hint: teamHint });

			const salesCol = statuses.find((s) => s.name === "Sales");
			const colOpts = visibleColumns().filter((s) => s.name !== "New");
			if (salesCol && !colOpts.some((s) => s.name === "Sales")) colOpts.unshift(salesCol); // hidden by the user: still pickable
			const statusSel = dropdown(colLabel(statuses.find((s) => s.name === "New") || { name: "New" }));
			statusSel.setOptions(colOpts.map((s) => ({ value: s.name, label: colLabel(s) })));
			statusSel.value = def.locked ? def.status : presetStatus && presetStatus !== "New" ? presetStatus : def.status;
			statusSel.style.width = "100%";
			const lockHint = el("span", "display:none;font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", "Kooxda Sales: shaqadu waxay gashaa tiirka " + (salesCol ? colLabel(salesCol) : "SALES"));
			field("Column", statusSel, { hint: lockHint });
			// Team Sales -> column SALES; leaving Sales -> back to CUSUB (managers can still pick another column).
			teamPick.addEventListener("change", () => {
				paintTeamHint();
				if (teamPick.value === "Sales" && salesCol) statusSel.value = "Sales";
				else if (teamPick.value !== "Sales" && statusSel.value === "Sales") statusSel.value = "";
			});
			if (def.locked) {
				[teamPick, statusSel].forEach((b) => {
					b.disabled = true;
					b.setAttribute("aria-disabled", "true");
					b.style.cursor = "not-allowed";
					b.style.background = T.subtle;
					b.firstChild.style.color = T.text500; // value label
					b.lastChild.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
					b.title = "Kooxda Sales: Team iyo Column waa go'an / Locked for the Sales team";
				});
				lockHint.style.display = "block";
			}

			const agentSel = dropdown("Unassigned");
			agentSel.setOptions(agents.map((a) => ({ value: a.name, label: a.agent_name || a.name, lead: () => avatarOf(a.agent_name || a.name, a.user_image, 24) })));
			agentSel.style.width = "100%";
			field("Assign to", agentSel);

			const desc = focusRing(el("textarea", inputStyle + "width:100%;height:auto;min-height:96px;resize:vertical;"));
			desc.placeholder = "What happened? Steps, error messages, anything that helps.";
			field("Description", desc, { full: true });

			const foot = el("div", "display:flex;align-items:center;gap:12px;padding:16px 24px;border-top:1px solid " + T.divider + ";");
			const note = el("span", "flex:1;min-width:0;font:400 12px/18px " + T.font + ";color:" + T.text300 + ";", "The caller gets a WhatsApp confirmation when WhatsApp is on.");
			const cancel = btnSecondary("Cancel");
			const save = btnPrimary("Create ticket");
			if (asUser) {
				save.disabled = true;
				save.title = "Preview only";
				save.style.opacity = "0.5";
			}
			foot.append(note, cancel, save);
			card.append(head, body, foot);
			overlay.append(card);
			document.body.append(overlay);
			subject.focus();

			const dirty = () => !!(subject.value.trim() || callerName.value.trim() || phone.value.trim() || desc.value.trim() || company);
			const close = (force) => {
				if (!force && dirty() && !window.confirm("Discard this ticket?")) return;
				closePop();
				overlay.remove();
				document.removeEventListener("keydown", onKey, true);
				if (returnFocus && returnFocus.focus) returnFocus.focus();
			};
			const onKey = (e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					if (openPop) return closePop();
					close();
				} else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
					e.preventDefault();
					save.click();
				} else if (e.key === "Tab") {
					const f = [...card.querySelectorAll("button:not([disabled]),input,textarea")];
					if (!f.length) return;
					if (e.shiftKey && document.activeElement === f[0]) {
						e.preventDefault();
						f[f.length - 1].focus();
					} else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
						e.preventDefault();
						f[0].focus();
					}
				} else e.stopPropagation(); // typing here must not drive board shortcuts
			};
			document.addEventListener("keydown", onKey, true);
			overlay.addEventListener("mousedown", (e) => e.target === overlay && close());
			closeX.addEventListener("click", () => close());
			cancel.addEventListener("click", () => close());

			const validPhone = (v) => {
				const c = String(v || "").replace(/[\s\-().]/g, "");
				let d = c;
				if (c.startsWith("+")) d = c.slice(1);
				else if (c.startsWith("00")) d = c.slice(2);
				let l = d;
				if (d.startsWith("252") && d.length === 12) l = d.slice(3);
				else if (d.startsWith("0") && d.length === 10) l = d.slice(1);
				if (/^[1-9]\d{8}$/.test(l)) return true;
				// Any other country's full international number (+ / 00 + 8-15 digits).
				return (c.startsWith("+") || c.startsWith("00")) && /^[1-9]\d{7,14}$/.test(d);
			};
			save.addEventListener("click", async () => {
				if (asUser) return;
				if (def.locked) {
					teamPick.value = "Sales"; // locked: never trust a changed control
					statusSel.value = def.status;
				}
				const errs = [
					[fSubject, subject.value.trim() ? "" : "Write a short subject."],
					[fCaller, callerName.value.trim() ? "" : "Enter the caller's name."],
					[fPhone, !phone.value.trim() ? "Enter the caller's phone." : validPhone(phone.value) ? "" : "Geli number Soomaali ah ama mid caalami ah (+country code), tusaale +2526XXXXXXXX ama +44XXXXXXXXXX."],
					[fCompany, coIn.value.trim() && !company ? "Pick a company from the list, or clear the field." : ""],
				];
				errs.forEach(([f, m]) => f.setError(m));
				const first = errs.find(([, m]) => m);
				if (first) return (first[0].querySelector("input,textarea") || subject).focus();
				save.disabled = true;
				save.textContent = "Creating…";
				try {
					const doc = await api(
						"frappe.client.insert",
						{
							doc: {
								doctype: "HD Ticket",
								subject: subject.value.trim(),
								description: desc.value.trim()
									? desc.value.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
									: "",
								erp_customer: company ? company.name : null,
								priority: prio.value || "Medium",
								status: statusSel.value || "New",
								caller_name: callerName.value.trim(),
								caller_phone: phone.value.trim(),
								source_team: teamPick.value || undefined,
							},
							// Read by Server Script "HD Ticket Sales Alert" (assignment happens right after the insert).
							yool_assign_to: agentSel.value || undefined,
						},
						true
					);
					if (agentSel.value) {
						await api("frappe.desk.form.assign_to.add", { doctype: "HD Ticket", name: doc.name, assign_to: [agentSel.value] }, true).catch((e) =>
							toast("Ticket created, but assigning failed: " + e.message, false)
						);
					}
					close(true);
					toast("Ticket #" + doc.name + " created", true);
					await loadAll();
					openPreview(doc.name);
				} catch (e) {
					toast("Could not create the ticket: " + e.message, false);
					save.disabled = false;
					save.textContent = "Create ticket";
				}
			});
		};

		state.openNewTicket = openNewTicket;

		// Column ⋮ menu — Figma "Dropdown menu" panel + list items (line icons, grouped sections, color swatches).
		const ARROW = {
			left: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
			right: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
			chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
		};
		const MENU_ICON = {
			plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
			move: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7 3 12l5 5M16 7l5 5-5 5M3 12h18"/></svg>',
			collapse: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/></svg>',
			expand: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>',
			collapseAll: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16"/><path d="m14 7-5 5 5 5M20 12H9"/></svg>',
			expandAll: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v16"/><path d="m10 7 5 5-5 5M4 12h11"/></svg>',
			empty: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 3"><circle cx="12" cy="12" r="8.5"/></svg>',
			left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
			right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
			whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8a4 4 0 0 1-2.2-2.2l.8-1-1-1.9Z"/></svg>',
			rename: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>',
			reset: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/></svg>',
			hide: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.7M6.6 6.6A13.3 13.3 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
			pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3Z"/></svg>',
			gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
		};
		// The panel lives in the shared popover slot (outside click / Esc / resize close it); render() closes it too.
		const closeMenu = () => {
			if (openPop && openPop.panel.dataset.colMenu) closePop();
		};
		const showMenu = (anchor, s, titleEl) => {
			if (openPop && openPop.trigger === anchor) return closePop();
			const W = 280;
			const panel = popPanel();
			panel.dataset.colMenu = "1";
			panel.setAttribute("role", "menu");
			panel.style.width = W + "px";
			panel.style.padding = "6px";
			panel.style.gap = "0";
			panel.style.borderRadius = "12px";
			panel.style.boxShadow = "0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)";
			const rowBase = "display:flex;align-items:center;gap:10px;min-height:38px;padding:0 10px;border-radius:8px;box-sizing:border-box;outline:none;" +
				"font:500 14px/20px " + T.font + ";color:" + T.text900 + ";white-space:nowrap;";
			const lead = (svg) => {
				const i = icn(svg, 18);
				i.style.color = T.text300;
				i.querySelector("svg").setAttribute("width", "18");
				i.querySelector("svg").setAttribute("height", "18");
				return i;
			};
			const hover = (n) => {
				n.addEventListener("mouseenter", () => (n.style.background = hoverBg));
				n.addEventListener("mouseleave", () => (n.style.background = ""));
			};
			// A full-width action row.
			const row = (svg, label, fn, trail) => {
				const r = el("div", rowBase + "cursor:pointer;");
				r.setAttribute("role", "menuitem");
				r.tabIndex = -1;
				r.append(lead(svg), el("span", "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;", label));
				if (trail) r.append(trail);
				hover(r);
				r.addEventListener("click", (e) => {
					e.stopPropagation();
					closePop();
					fn();
				});
				panel.append(r);
				return r;
			};
			// A row holding several small choices (merges related actions into one line).
			const chip = (text, title, fn, svg) => {
				const c = el(
					"button",
					"display:inline-flex;align-items:center;justify-content:center;height:26px;min-width:30px;padding:0 9px;border:0;border-radius:6px;" +
						"background:transparent;cursor:pointer;font:500 12px/18px " + T.font + ";color:" + T.text500 + ";transition:background 120ms,color 120ms,box-shadow 120ms;",
					svg ? null : text
				);
				if (svg) c.innerHTML = svg; // static SVG constant
				c.type = "button";
				c.title = title;
				c.setAttribute("aria-label", title);
				const on = (v) => {
					c.style.background = v ? T.surface : "transparent";
					c.style.color = v ? T.text900 : T.text500;
					c.style.boxShadow = v ? "0 1px 2px rgba(16,24,40,0.08)" : "none";
				};
				c.addEventListener("mouseenter", () => on(true));
				c.addEventListener("mouseleave", () => on(false));
				c.addEventListener("focus", () => on(true));
				c.addEventListener("blur", () => on(false));
				c.addEventListener("click", (e) => {
					e.stopPropagation();
					closePop();
					fn();
				});
				return c;
			};
			const choiceRow = (svg, label, chips) => {
				const r = el("div", rowBase);
				const box = el("div", "display:inline-flex;gap:2px;margin-left:auto;padding:2px;border-radius:8px;background:" + T.subtle + ";border:1px solid " + T.divider + ";");
				chips.forEach((c) => box.append(c));
				r.append(lead(svg), el("span", "color:" + T.text900 + ";", label), box);
				panel.append(r);
			};
			const sep = () => panel.append(el("div", "height:1px;margin:6px 4px;background:" + T.divider + ";flex:0 0 auto;"));
			const collapseAllCols = (value) => {
				setCollapsed(visibleColumns().map((x) => x.name), value);
				render();
			};

			row(MENU_ICON.plus, "New ticket here", () => openNewTicket(s.name)).firstChild.style.color = T.brand;
			sep();
			if (isCollapsed(s)) row(MENU_ICON.expand, "Expand column", () => toggleColumn(s));
			else row(MENU_ICON.collapse, "Collapse column", () => toggleColumn(s));
			choiceRow(MENU_ICON.collapseAll, "All", [
				chip("Collapse", "Collapse all columns", () => collapseAllCols(true)),
				chip("Expand", "Expand all columns", () => collapseAllCols(false)),
				chip("Empty", "Collapse empty columns", () => {
					setCollapsed(visibleColumns().filter((x) => !(columns[x.name] && columns[x.name].count)).map((x) => x.name), true);
					render();
				}),
			]);
			choiceRow(MENU_ICON.move, "Move", [
				chip("", "Move column left", () => moveColumn(s.name, -1), ARROW.left),
				chip("", "Move column right", () => moveColumn(s.name, 1), ARROW.right),
			]);

			sep();
			// WhatsApp text customers get when a ticket enters this column; the tag shows its state at a glance.
			const wr = (waInfo.rows || []).find((x) => x.status === s.name);
			const off = !!(wr && !wr.enabled);
			const state = s.name === "Sales" ? ["Internal", T.text500, T.subtle] : waInfo.whatsapp_paused ? ["Paused", "#b42318", dark ? "rgba(217,45,32,0.16)" : "#fef3f2"] : off ? ["Off", T.text500, T.subtle] : ["On", T.brandSoftText, T.brandSoftBg];
			const tag = el("span", "flex:0 0 auto;padding:0 8px;border-radius:120px;font:500 12px/20px " + T.font + ";color:" + state[1] + ";background:" + state[2] + ";", state[0]);
			const trail = el("span", "display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;");
			const chev = icn(ARROW.chevron, 16);
			chev.style.color = T.text300;
			trail.append(tag, chev);
			row(MENU_ICON.whatsapp, "WhatsApp message", () => openMsgEditor([s]), trail).firstChild.style.color = "#25d366";

			if (canEdit) {
				sep();
				if (titleEl) row(MENU_ICON.rename, "Rename", () => startRename(s, titleEl));
				if (colSettings(s).label) row(MENU_ICON.reset, "Reset name", () => updateColumn(s.name, { label: null }));
				row(MENU_ICON.hide, "Hide column", () => updateColumn(s.name, { hidden: true }));
				row(MENU_ICON.pin, "Use my order for everyone", saveOrderForEveryone);
				row(MENU_ICON.gear, "Team numbers / Numbarrada kooxaha", () => openTeamNumbers());
				// Color for everyone: one line of swatches, the current one ringed.
				const current = String(colColor(s)).toLowerCase();
				const sw = el("div", "display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px;");
				sw.title = "Column color (everyone)";
				[...new Set(Object.values(COLORS))].forEach((c) => {
					const name = Object.keys(COLORS).find((k) => COLORS[k] === c);
					const on = c.toLowerCase() === current;
					const dot = el(
						"button",
						"width:20px;height:20px;flex:0 0 auto;border-radius:50%;padding:0;cursor:pointer;background:" + c + ";border:2px solid " + T.surface + ";transition:transform 120ms;" +
							"box-shadow:0 0 0 " + (on ? "2px " + T.text900 : "1px " + T.divider) + ";"
					);
					dot.type = "button";
					dot.title = name + " (everyone)";
					dot.setAttribute("aria-label", "Column color " + name + (on ? ", current" : ""));
					dot.addEventListener("mouseenter", () => (dot.style.transform = "scale(1.15)"));
					dot.addEventListener("mouseleave", () => (dot.style.transform = ""));
					dot.addEventListener("click", (e) => {
						e.stopPropagation();
						closePop();
						updateColumn(s.name, { color: c });
					});
					sw.append(dot);
				});
				panel.append(sw);
			}
			if (!anchor.setOpen) anchor.setOpen = () => {};
			openPopover(anchor, panel);
			panel.style.minWidth = W + "px";
			// Right-aligned under the ⋮ button; when it does not fit below, it slides up just enough (never off-screen).
			const r = anchor.getBoundingClientRect();
			const h = panel.getBoundingClientRect().height;
			panel.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.right - W)) + "px";
			panel.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - 8 - h)) + "px";
		};
		const startRename = (s, titleEl) => {
			titleEl.contentEditable = "true";
			titleEl.style.outline = "1px solid #fff";
			titleEl.style.textOverflow = "clip";
			titleEl.focus();
			document.getSelection().selectAllChildren(titleEl);
			let done = false;
			const finish = async (keep) => {
				if (done) return;
				done = true;
				titleEl.contentEditable = "false";
				titleEl.style.outline = "";
				const text = titleEl.textContent.trim().slice(0, 60);
				if (!keep || !text || text === colLabel(s)) return render();
				await updateColumn(s.name, { label: text === s.name ? null : text });
			};
			titleEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					finish(true);
				} else if (e.key === "Escape") finish(false);
			});
			titleEl.addEventListener("blur", () => finish(true), { once: true });
		};

		// ---------- column pieces ----------
		const ICONS = { Open: "●", Paused: "⏸", Resolved: "✓" };
		const iconBtn = (text, title) => {
			const b = el(
				"button",
				"border:0;background:none;cursor:pointer;color:" + T.text500 + ";font-size:15px;padding:2px 6px;line-height:1;border-radius:6px;",
				text
			);
			b.title = title;
			return b;
		};
		const handle = () => {
			const h = el("span", "cursor:grab;color:" + T.text300 + ";font-size:12px;letter-spacing:-3px;user-select:none;padding:0 3px;", "⋮⋮");
			h.title = "Drag to reorder";
			h.draggable = true;
			return h;
		};
		// Drop target for both cards (change status) and column handles (reorder).
		const wireColumn = (node, s, h) => {
			h.addEventListener("dragstart", (e) => {
				e.stopPropagation();
				e.dataTransfer.setData("text/plain", "column:" + s.name);
				e.dataTransfer.effectAllowed = "move";
				state.draggingColumn = s.name;
				state.dragging = null;
			});
			h.addEventListener("dragend", () => (state.draggingColumn = null));
			h.addEventListener("click", (e) => e.stopPropagation());
			node.addEventListener("dragover", (e) => {
				if (!state.dragging && !state.draggingColumn) return;
				e.preventDefault();
				node.style.outline = "2px dashed " + colColor(s);
				node.style.outlineOffset = "-2px";
			});
			node.addEventListener("dragleave", (e) => {
				if (!node.contains(e.relatedTarget)) node.style.outline = "";
			});
			node.addEventListener("drop", (e) => {
				e.preventDefault();
				node.style.outline = "";
				const column = state.draggingColumn;
				const drag = state.dragging;
				state.draggingColumn = null;
				state.dragging = null;
				if (column) moveColumnBefore(column, s.name);
				else if (drag) moveTicket(drag.ticket.name, drag.from, s.name);
			});
		};
		const pill = (s, count) => {
			const p = el(
				"span",
				"display:inline-flex;align-items:center;gap:6px;min-width:0;padding:3px 4px 3px 9px;border-radius:999px;color:#fff;" +
					"font-size:11px;font-weight:700;letter-spacing:.06em;background:" +
					colColor(s) +
					";"
			);
			const label = el("span", "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;", colLabel(s));
			label.title = colLabel(s) !== s.name ? "Status: " + s.name : s.name;
			p.append(
				el("span", "font-size:9px;opacity:.9;", ICONS[s.category] || "●"),
				label,
				el(
					"span",
					"flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#fff;color:#111;" +
						"display:inline-flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:0;",
					String(count)
				)
			);
			return { pill: p, label };
		};
		const fullColumn = (s, data) => {
			const col = el(
				"div",
				"flex:1 1 260px;min-width:210px;max-width:340px;display:flex;flex-direction:column;max-height:100%;border-radius:12px;" +
					"background:" + T.subtle + ";border:1px solid " + T.divider + ";"
			);
			const head = el("div", "display:flex;align-items:center;gap:4px;padding:12px 8px 10px 6px;");
			const h = handle();
			const parts = pill(s, data.count);
			if (canEdit) {
				parts.label.style.cursor = "text";
				parts.label.addEventListener("dblclick", () => startRename(s, parts.label));
			}
			const more = iconBtn("···", "Column options");
			more.style.marginLeft = "auto";
			more.addEventListener("click", (e) => {
				e.stopPropagation();
				showMenu(more, s, parts.label);
			});
			const collapse = iconBtn("‹", "Collapse column");
			collapse.addEventListener("click", (e) => {
				e.stopPropagation();
				toggleColumn(s, col);
			});
			head.append(h, parts.pill, more, collapse);

			const body = el("div", "flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px 10px 10px;min-height:60px;");
			data.tickets.forEach((t) => body.append(card(t, s)));
			if (data.tickets.length < data.count) {
				const lm = el("button", btnStyle + "width:100%;padding:8px 12px;color:" + T.text500 + ";", "Load more (" + (data.count - data.tickets.length) + ")");
				lm.addEventListener("click", async () => {
					lm.textContent = "Loading…";
					await loadColumn(s, true);
					render();
				});
				body.append(lm);
			}
			if (!data.tickets.length)
				body.append(
					el(
						"div",
						"padding:20px 12px;border:1px dashed " + T.border + ";border-radius:8px;text-align:center;color:" + T.text300 + ";font:500 12px/18px " + T.font + ";",
						"No tickets — drop one here"
					)
				);
			col.append(head, body);
			wireColumn(col, s, h);
			return col;
		};
		const strip = (s, data) => {
			const c = colColor(s);
			const col = el(
				"div",
				"flex:0 0 " + STRIP + "px;min-width:" + STRIP + "px;max-width:" + STRIP + "px;display:flex;flex-direction:column;" +
					"align-items:center;gap:10px;padding:8px 0;border-radius:12px;cursor:pointer;overflow:hidden;" +
					"background:" + c + "1f;border:1px solid " + c + "55;"
			);
			col.title = colLabel(s) + " (" + data.count + ") — click to expand";
			const h = handle();
			const expand = iconBtn("›", "Expand column");
			const badge = el(
				"span",
				"min-width:24px;height:24px;padding:0 6px;border-radius:999px;color:#fff;display:inline-flex;align-items:center;" +
					"justify-content:center;font-size:11px;font-weight:700;background:" + c + ";",
				String(data.count)
			);
			const name = el(
				"span",
				"writing-mode:vertical-rl;text-transform:uppercase;letter-spacing:.14em;font:600 11px/1 " + T.font + ";" +
					"color:" + T.text500 + ";white-space:nowrap;",
				colLabel(s)
			);
			col.append(h, expand, badge, name);
			col.addEventListener("click", () => toggleColumn(s, col));
			wireColumn(col, s, h);
			return col;
		};

		const render = () => {
			closeMenu();
			board.textContent = "";
			hiddenBox.textContent = "";
			const hidden = ordered().filter((s) => colSettings(s).hidden);
			updateStats();
			if (hidden.length) {
				hiddenBox.append(el("span", "font:500 14px/20px " + T.font + ";color:" + T.text300 + ";", "Hidden columns"));
				hidden.forEach((s) => {
					// Figma Pill (neutral): bg-gray-secondary-hover + text-gray-secondary.
					const chip = el(
						"span",
						"display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:120px;font:500 14px/20px " + T.font + ";" +
							"background:" + (dark ? "var(--surface-gray-3,#343434)" : "#f0f0f1") + ";color:" + T.text500 + ";" + (canEdit ? "cursor:pointer;" : ""),
						colLabel(s) + (canEdit ? "  ＋" : "")
					);
					if (canEdit) {
						chip.title = "Show column";
						chip.addEventListener("click", async () => {
							await updateColumn(s.name, { hidden: false });
							await loadColumn(s);
							render();
						});
					}
					hiddenBox.append(chip);
				});
			}
			visibleColumns().forEach((s) => {
				const data = columns[s.name] || { tickets: [], count: 0 };
				board.append(isCollapsed(s) ? strip(s, data) : fullColumn(s, data));
			});
		};

		// Filter events
		const onFilter = async () => {
			filters.agent = agentSel.value;
			filters.team = teamSel.value;
			filters.priority = prioSel.value;
			filters.from = fromIn.value;
			filters.to = toIn.value;
			filters.showOld = oldChk.checked;
			const company = companyIn.value.trim();
			if (company !== filters.company) {
				filters.company = company;
				companyIds = company
					? (await getList("Customer", ["name"], [["customer_name", "like", "%" + escapeLike(company) + "%"]], { limit_page_length: 200 }).catch(() => [])).map(
							(r) => r.name
					  )
					: null;
			}
			loadAll();
		};
		[agentSel, teamSel, prioSel, fromIn, toIn, oldChk].forEach((i) => i.addEventListener("change", onFilter));
		companyIn.addEventListener("change", onFilter);
		refreshBtn.addEventListener("click", loadAll);
		expandBtn.addEventListener("click", () => {
			setCollapsed(visibleColumns().map((x) => x.name), false);
			render();
		});
		document.addEventListener("click", (e) => {
			if (!(openPop && openPop.panel.dataset.colMenu && openPop.panel.contains(e.target))) closeMenu();
		});

		await loadAll();
		// ?preview=<ticket> keeps the panel open across reloads and shared links.
		const initial = new URLSearchParams(window.location.search).get("preview");
		if (initial) openPreview(initial);
	};

	const removeBoard = () => {
		const root = document.getElementById(ROOT_ID);
		if (!root) return;
		const main = root.parentElement;
		root.remove();
		document.querySelectorAll("[data-yool-pop]").forEach((p) => p.remove());
		if (main) {
			main.style.overflow = state.mainOverflow || "";
			main.style.background = state.mainBackground || "";
		}
	};

	const sync = () => {
		if (isRoute()) buildBoard();
		else removeBoard();
	};

	// Follow Helpdesk route changes for the rest of the session (one watcher only).
	if (!state.watcher) {
		state.href = window.location.href;
		state.watcher = setInterval(() => {
			const missing = isRoute() && !document.getElementById(ROOT_ID);
			if (state.href === window.location.href && !missing) return;
			state.href = window.location.href;
			sync();
		}, 300);
	}
	sync();

	return { actions: [] };
}
