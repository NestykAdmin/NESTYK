# Agent web · UI audit (ui-redesign step 1–2) · 4 Nov 2026

- Asked by Mos: "ลองเอา ui-redesign มาช่วยวิเคราะ", then "ลองวิเคราะดูทั้งมีและไม่มีข้อมูล". Done by Mild. **Audit and proposal only: nothing changed yet. Waiting for Mos's approval.**
- Code: `pre/dev/web/agent` @ `ffa852e` (clean tree). Claude's browser.
- **Empty:** QA Super Admin account (no rooms or leads): `/agent`, `/agent/rooms`, `/agent/leads` at 1440 light + dark, and 390. Screenshots in `before/`.
- **With data:** QA Agent account (36 rooms, 24 leads, 8 tenants, 1 viewing today, 14 to-dos): dashboard (top / middle / bottom), rooms (list + grid), leads, tenants, calendar at 1440, dashboard at 1024. Screenshots in `with-data/`.
- 390 = phone width, which shows the app screens (frozen): out of scope.

## BEFORE metrics (agent web CSS + web TSX: `agent-web/*.css`, `agent-web/ui/*`, `agent-web/*.web.tsx`, `web-notify/*`; 2,503 CSS lines)

| Metric | Value |
|---|---|
| Hard-coded hex colours | 199 uses, **88 distinct** (theme variables: only 6 `--aw-*`) |
| `rgb()/rgba()` | 7 |
| Distinct padding / margin / gap values | **27** (1–50px, incl. 3, 5, 7, 9, 11, 13, 15, 17px) |
| Distinct font sizes | **14** (9–24px). 12px used 40×; smallest 9px |
| Distinct border radii | **15** |
| Font families | 2 (Noto Sans Thai, Mitr) + 1 monospace (build badge) |
| Slop signs | gradient 1 (skeleton shimmer, fine) · uppercase 1 · letter-spacing 2 · box-shadow 13 · animation 8 (all tied to an action or loading) · emoji 0 · glow 0 |

The base is clean and calm. The problems are **scale** (too many one-off values), **hierarchy** (repeated labels, tiny Thai text) and, with real data, **density**: the list pages are phone layouts stretched to 1440px.

## Empty vs with data

| Screen | Empty (QA Super Admin) | With data (QA Agent) |
|---|---|---|
| Dashboard | Five "0" cards, then three tall white cards with one grey line each ("ไม่มีงานเร่งด่วนตอนนี้"). No next step | Useful: "งานที่ต้องทำ 14" (overdue ฿35,000, 13 leads to follow up), room stock table, rent collected ฿15,000 of ฿70,000. But the to-do list is the **second** block; at 1024 it is **below the fold** after the KPI cards (2 columns + one orphan). Tenant overview card is stretched to the room-stock height (half empty). Commission card takes a third of a row to say "not available". Activity repeats the same contract name 4× |
| Room Listings | "0 ห้อง" and a grey "ไม่มีข้อมูล" in an empty white page | 36 rooms as **phone cards stretched to 1,100px**: name at the left, price ~900px away at the right; about 4½ rooms per screen; status pill sits on the photo; placeholder letter "E" thumbnails. **Grid view is broken on desktop**: 2-column phone grid, each photo ~700px tall, **one room per screen** |
| Leads | Status chips all "0", "ไม่มีข้อมูล" | 24 leads as tall rows with an empty middle. 4 of the first 5 rows show the same yellow "ข้อมูลไม่พอ" icon (noise). The 80% match ring is **red** (agent role colour), which reads as "bad" |
| Tenants | (not opened empty) | A **centred ~420px column** on a 1440 page, while Rooms and Leads are full width. Grouped by project with one tenant per group, so every row has its own heading. The yellow segmented control (งานค้าง / ผู้เช่าทั้งหมด) is the loudest thing on the page and competes with the "สร้างผู้เช่า" button |
| Calendar | (not opened empty) | Month grid reads well; the selected day is yellow. The event count on a day is a tiny badge; the day's list starts below the fold |

Also seen with data (to check, not design): the dashboard says "ไม่มีนัดหมายวันนี้" / 0 while the calendar lists one viewing today at 14:26 (status done). If the dashboard counts only upcoming viewings, its label should say so.

## Issues, ranked by impact

| # | Issue | Where | Why it matters |
|---|---|---|---|
| 1 | **List pages are phone layouts stretched to desktop**: rooms 4½ per screen with name and price ~900px apart; grid view one room per screen; leads tall rows; tenants in a narrow centred column. Empty lists show a bare "ไม่มีข้อมูล" | `AgentRoomsScreen.tsx`, `AgentLeadsScreen.tsx`, `AgentTenantsScreen.tsx` (phone files inside the shell) | The pages agents use most. Fixed by step 4 with `WebTable` + `WebState` (tables, compare columns at a glance, real empty / no-match states) |
| 2 | **The to-do list is not first on the dashboard**: five KPI cards come first (one of them a disabled feature); at 1024 the to-do list falls below the fold | `AgentOverview.web.tsx`, `agent-overview.css` | "งานที่ต้องทำ" is the block that tells the agent what to do now (overdue rent, leads to follow up) |
| 3 | **Thai text too small**: "เร็ว ๆ นี้" badge 9px, sidebar captions 11px, account e-mail 11px, KPI labels 12px; 12px used 40× | `agent-workspace.css:191` (`.aw-soon`), `:141` (`.aw-nav-caption`), `agent-overview.css` | Thai glyphs need more size than Latin; floor 12px for captions, 14px for body |
| 4 | **Colour meaning is mixed up**: red role dot on the Agent tile looks like an alert; the lead match ring is red at 80%; the strongest yellow on Tenants is a tab control, not the main action | `AgentWorkspace.web.tsx:600` (`.aw-switch-dot`), lead match ring (app component), tenants segmented control | Red should mean "problem", yellow "do this" |
| 5 | **Three headings say the same thing**: top bar title + breadcrumb + "พื้นที่ทำงานนายหน้า" line on every page; refresh on its own row on the dashboard | `AgentSectionHeader.web.tsx:39-40`, `AgentWorkspace.web.tsx:1179-1209` | ~60–100px lost per page; with data that is one more row of rooms or leads |
| 6 | **Token sprawl**: 88 colours, 27 spacings, 15 radii, 14 font sizes; yellow in ~8 shades | `agent-workspace.css`, `agent-overview.css`, `ui/agent-web-ui.css`, `web-notify/*` | Step 4–5 pages will copy whatever they find |
| 7 | **Dashboard card heights**: cards in one row stretch to the tallest (tenant overview half empty); commission card spends a third of a row on "not available"; activity feed repeats one contract | `agent-overview.css` grid rows | Space goes to nothing while the to-do list is pushed down |
| 8 | **Repeated warnings**: "ข้อมูลไม่พอ" on most leads | leads list rows | When everything warns, nothing does; show it once as a filter count instead |
| 9 | **Coming-soon items fill half the sidebar**: 5 of 11 items across 3 groups | `AgentWorkspace.web.tsx`, `navigation.ts` | Rule stays (shown, disabled); they can sit together at the end, quieter |
| 10 | Card titles: two styles (14px Noto vs 17px Mitr) | `agent-overview.css`, `ui/agent-web-ui.css` | One card style |
| 11 | Dark mode navy vs warm brand | theme | Low; contrast passes |

Checked and fine: muted text contrast 4.76:1 (AA), focus rings present, reduced motion respected in new parts, no emoji/gradient/glow, one accent colour, calendar month grid.

## Proposed direction

- **Character:** a tidy work notebook for a rental agent: warm, calm, quick to scan. Rooms, leads and tenants are things to act on, not numbers to admire.
- **One bright moment:** the CI yellow is kept for **"what needs you now"**: the to-do list at the top of the dashboard and the one main button of each page. Everything else is neutral; red only for problems (overdue, errors).
- **Signature detail:** room numbers as a small **key tag** (`ห้อง 1204`, tag shape with a key-ring hole), the same in every table that shows a room (rooms, lead matches, tenants, calendar).
- **Tokens (reuse, then add a small scale):** keep `--aw-bg`, `--aw-surface`, `--aw-ink`, `--aw-muted`, `--aw-border`, `--aw-brand`. Add space `--aw-s1…s6` (4 / 8 / 12 / 16 / 24 / 32), radius `--aw-r-sm/md/lg` (8 / 12 / 16, pill 999), text `--aw-t-caption/body-sm/body/title/page` (12 / 13 / 14 / 16 / 20; Thai floor 12px), roles `--aw-brand-soft` `#FFF4D8`, `--aw-brand-ink` `#583C0A`, `--aw-danger` `#B42318`, `--aw-success` `#1F6B43`. No new theme system.
- **Scope (visual only, web files only; mobile, API, data flow untouched):**
  1. Token pass + Thai text floor (`agent-workspace.css`, `agent-overview.css`, `ui/agent-web-ui.css`, `web-notify/web-notifier.css`).
  2. Header clean-up: drop the "พื้นที่ทำงานนายหน้า" line and the duplicate breadcrumb on top-level pages; refresh joins the page's button row (D4).
  3. Sidebar: role dot → neutral ring in the role colour; coming-soon items grouped at the end.
  4. Dashboard: to-do list first and full width; KPI row smaller (commission out of the main row until it works); cards keep their own height; empty cards use `WebState` compact with a next step.
  5. Step 4 list pages on these tokens: Rooms as a `WebTable` (photo · room with key tag · area · type · price · status · updated) with a real desktop grid (4 columns at 1440); Leads as a table with one readiness column instead of a warning per row, match % in neutral/green; Tenants full width like the others, project as a column instead of a heading per row.
- **Not in scope:** phone-width screens (frozen app), fonts (Noto Sans Thai + Mitr stay), data rules.

## Suggested order

1–3 now (about ½ day) so step 4 starts on the tokens; 4 next to step 4's first page; 5 is step 4 itself (Rooms → Leads → Tenants). After approval: AFTER screenshots at the same sizes and accounts (empty + with data), the same metrics, tests + `tsc`, and a before/after report.

## Needs Mos

- Approve the direction (or change the character / bright moment / signature detail).
- Coming-soon items: group them at the end of the sidebar (still shown, disabled), or keep the current groups.
- D4 refresh: keep it in the page's button row, or remove it.
- Dashboard "นัดหมายวันนี้ 0" vs the viewing on the calendar today: intended (upcoming only) or a bug?
