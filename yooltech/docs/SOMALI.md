# Isbeddellada Yooltech ee Helpdesk — soo koobid

**Waa maxay?** Dhammaan wixii Yooltech ku dhisay Helpdesk-ka `my.yool.tech` waxay hadda ku jiraan hal app oo
la rakibi karo: `yooltech/yool_theme`. Koodka Helpdesk-ka laftiisa waxba lagama beddelin.

**Waxa ku jira:**
- **Agent Ticket Report** — warbixinta agent-yada (tirada ticket-yada, nooca cilada, shirkadaha, kharashka Bajaaj,
  tiirka "Ka yimid" Sales/Technical). Waxay ka muuqataa sidebar-ka Helpdesk ("Agent Report").
- **Kanban** — tiirar status ah, jiid-iyo-dhig, Preview, foom ticket cusub (shirkad, qofka soo wacay, koox),
  dooro noocyo badan oo cilad ah iyo "+ Add".
- **Chatwoot / WhatsApp** — ticket kasta oo status-kiisu isbeddelo, macmiilka wuxuu helayaa HAL fariin Soomaali
  ah ("Codsigaaga #... — Yooltech Support"); agent-ka loo xilsaaray wuxuu helayaa fariin; JOOJI, pause, rate limit.
- **Hubinta qofka soo wacay** — magaca + taleefanka waa qasab; lambarada Soomaaliga waxay noqdaan +252...,
  lambarada caalamiga ah (+country code) waa la aqbalaa. Shirkadda iyo xiriirka si toos ah ayay u buuxsamaan.
- **Engineer Monthly Report** iyo **Team Monthly Report** — warbixinnada bilaha ah, dashboard, Print Format iyo
  soo dejinta Word.
- **Noocyada cilada** — 45 nooc, ticket wuxuu yeelan karaa noocyo badan, lama xiri karo nooc la'aan.
- **Kooxaha** — "Technical" ayaa go'aamiya cidda injineer ah; "Sales" ticket-yadeeda waxay fariin u diraan
  kooxda Technical, waxayna ku dhacaan tiirka **SALES** ee Kanban-ka (ka hor CUSUB); Technical ayaa ka qaada
  (Assigned / In Progress). Macmiilka fariin looma diro marka ticket-ku SALES galo. Numbarrada kooxaha waxaa
  laga beddelaa Kanban-ka: "⚙ Team numbers / Numbarrada kooxaha" (maamulayaasha keliya).
- **Naqshadda Figma** — sidebar-ka Desk, Helpdesk, CRM iyo portal-ka.

**Waxa aan git-ka la gelin (admin-ka ayaa gacanta ku gelinaya):** furayaasha Chatwoot (API token, webhook key,
internal key), lambarada taleefanka kooxaha (Chatwoot Settings → "Numberka Kooxda Technical / Sales"), xubnaha kooxaha
Technical/Sales, iyo xog kasta oo macaamiil ah.

**Rakibaadda:** `bench --site <site> install-app yool_theme` kadibna `bench --site <site> migrate`.
Faahfaahinta (install, upgrade, rollback) waxay ku qoran tahay `docs/README.md` (English).

**Ogow:** marka Chatwoot shidan yahay oo "test numbers" madhan yihiin, isbeddel kasta oo status ah wuxuu fariin
u dirayaa macmiilka dhabta ah.
