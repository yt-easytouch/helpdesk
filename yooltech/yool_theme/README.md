# yool_theme

A small Frappe 16 app that applies Yooltech's Figma design (file "UI-dinsg", Side Menu `10450:5374`) to
every sidebar of the site, natively and on every page load:

| Surface | How it is loaded | Files |
|---|---|---|
| Desk (`/app`, `/desk`) workspace sidebar | `app_include_css` / `app_include_js` | `public/css/desk_theme.css`, `public/js/desk_theme.js` |
| Helpdesk 1.26 (`/helpdesk/*`, agent + customer portal, incl. a **direct load of `/helpdesk/home`**) | `after_request` hook adds the tags to the Helpdesk HTML | `public/css/helpdesk_theme.css`, `public/js/helpdesk_theme.js` |
| Frappe CRM (`/crm/*`) | same `after_request` hook | `public/css/crm_theme.css` |
| Website portal sidebar (`/orders`, `/invoices`, `/issues` ...) | `web_include_css` | `public/css/portal_theme.css` |
| Desk launcher tiles (`/desk`, `/apps`) | **optional**, off by default | `public/css/desk_launcher_icons.css` |

Look: white sidebar, `#dadadb` border, Manrope, 36px rows, 4px corners, active item brand green `#1db487`
with white text and icon, Figma line icons (CSS masks, no icon JavaScript). Collapsed rails keep their size.
The theme itself needs no DocTypes and no edits to Helpdesk/CRM files. Every rule is scoped to the
sidebar containers, so forms, lists and reports are not restyled. See `SURVEY.md` for the full inventory.

**Since 0.2.0 the app also carries all Yooltech Helpdesk customizations** (DocTypes, custom fields, Server /
Client / HD Form Scripts, Agent Ticket Report, print formats, HD Views) as fixtures plus seeded records — see
[`../docs/README.md`](../docs/README.md) for features, install, configuration and rollback. Installing the app
therefore DOES change the database (`bench --site <site> backup` first). Requires Helpdesk (`required_apps`).

## Install

```bash
cd ~/frappe-bench
# from a git remote you host:
bench get-app https://<your-git>/yool_theme.git
# or from the zip:
unzip yool_theme.zip -d apps/ && bench pip install -e apps/yool_theme && \
  (grep -qx yool_theme sites/apps.txt || echo yool_theme >> sites/apps.txt)

bench --site <site> install-app yool_theme      # site that serves my.yool.tech / portal.yool.tech
bench build --app yool_theme
bench --site <site> clear-cache
bench restart                                   # loads the new after_request hook in the workers
```

## Helpdesk: why a hook, and the manual alternative

Helpdesk serves `/helpdesk/*` from `helpdesk/www/helpdesk/index.html`, which its Vite build generates from
`desk/index.html`. That template renders only the boot data, never `app_include_*` / `web_include_*`.
Context hooks (`update_website_context`, `extend_website_page_controller_context`) only change Jinja variables
that this template does not print, so they cannot add a stylesheet. Frappe 16 runs every `after_request` hook
with the finished response (`frappe/app.py` `run_after_request_hooks`), so `yool_theme.theme_inject` inserts
two tags before `</head>` of `/helpdesk*` and `/crm*` HTML responses only (GET, 200, `text/html`). It skips
anything else, never raises, and does nothing if the tags are already present.

Alternative without the hook (edit Helpdesk itself): apply `server_patch/helpdesk_desk_index_html.patch` to the
Helpdesk app, then rebuild it. The patch adds these lines before `</head>`:

```html
<link rel="stylesheet" href="/assets/yool_theme/css/helpdesk_theme.css" />
<script defer src="/assets/yool_theme/js/helpdesk_theme.js"></script>
```

```bash
cd apps/helpdesk && patch -p1 < ../yool_theme/server_patch/helpdesk_desk_index_html.patch
cd ../.. && bench build --app helpdesk && bench --site <site> clear-cache
```

(Editing only the generated `helpdesk/www/helpdesk/index.html` also works, but the next Helpdesk build overwrites it.)
If you use the patch, you can delete the `after_request` line from `yool_theme/hooks.py`. Keeping both is safe.

## Verify

```bash
curl -s https://portal.yool.tech/helpdesk/home | grep -c yool_theme     # expect 1 or more
curl -sI https://portal.yool.tech/assets/yool_theme/css/helpdesk_theme.css | head -1   # 200
```

In a browser (hard refresh):
- open `https://portal.yool.tech/helpdesk/home` directly: 256px white sidebar, green "Home", Figma icons, white KPI cards with uppercase labels, green chart lines;
- `/helpdesk/my-tickets` (customer portal) and `/crm` show the same sidebar style;
- `https://my.yool.tech/app`: Desk sidebar 256px, active item green, Figma icons; collapse/expand still works; lists and forms look unchanged;
- `/orders`: portal sidebar with icons.

## Existing HD Form Scripts

"Helpdesk Figma Theme" and "Helpdesk Figma Theme Ticket" (overlay `window.__yoolFigTheme`) can stay enabled:
this app uses the same values and is idempotent with it. Once the app is installed they are no longer needed
and can be disabled (Enabled = 0) at any time; nothing here depends on them.

## Optional: Desk launcher icons

Replaces the launcher tile images with Figma icons on a light green tile (brand logos stay). In `hooks.py`:

```python
app_include_css = ["/assets/yool_theme/css/desk_theme.css", "/assets/yool_theme/css/desk_launcher_icons.css"]
```

then `bench build --app yool_theme && bench --site <site> clear-cache`. Not tested on the live site.

## Uninstall / rollback

```bash
bench --site <site> uninstall-app yool_theme    # theme part only; fixture records stay (see ../docs/README.md)
bench remove-app yool_theme
bench build && bench --site <site> clear-cache && bench restart
```

Quick rollback without uninstalling: comment out the include lines and `after_request` in `yool_theme/hooks.py`,
then `bench --site <site> clear-cache && bench restart`. If you applied the Helpdesk patch:
`cd apps/helpdesk && patch -R -p1 < ../yool_theme/server_patch/helpdesk_desk_index_html.patch && bench build --app helpdesk`.

## Changing icons

Icons are in `yool_theme/public/icons/figma/*.svg` (exported from the Figma Icons page; `_index.json` lists
layer name and node id). Mappings are in `tools/build_icons.py`; run `python3 tools/build_icons.py --report`
to regenerate the icon blocks in the CSS files and list Desk icons that still need a Figma icon.

## Notes

- Fonts: Manrope from Google Fonts (same as the current HD Form Scripts). Without network access to Google,
  the sidebar falls back to the system font.
- Asset URLs carry `?v=<app version>-<build version>`, so `bench build` busts browser caches.
- Selectors depend on Frappe 16 / Helpdesk 1.26 / CRM 1.81 markup. After major upgrades, re-check that the
  sidebar is still themed. If markup changed, the pages fall back to stock styling; nothing breaks.
