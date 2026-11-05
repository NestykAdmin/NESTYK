# Agent web redesign: passes 1–3 report (4 Nov 2026)

Branch `pre/dev/web/agent`, on top of `ffa852e`. **Not committed.** Mos reviews and commits.
Scope: the web shell and the dashboard. List pages (Rooms, Leads, Tenants) are step 4 and are not part of this report.

## Decisions applied (Mos, 4 Nov)

| # | Decision | What was done |
|---|---|---|
| 1 | "ทำเลย": do the redesign | Passes 1–3 below |
| 2 | "คงไว้": keep the coming-soon sidebar groups | Kept. Only the badge style changed (see the 1024 fix below) |
| 3 | "เอาออก": remove the refresh button (D4) | Removed from the page and from the top bar. Pages load fresh data when they open, and browser reload still works |
| 4 | "นับเฉพาะนัด": count only appointments | No change. The dashboard already counts only upcoming appointments |

## Pass 1: tokens and the Thai text floor

There is now one scale for every web page: `:root` `--aw-*` tokens in `ui/agent-web-ui.css`, plus dark overrides.
- **Space:** s1–s8 (4/8/12/16/20/24/32/48)
- **Radius:** xs–xl and pill
- **Text:** caption 12, small 13, body 14, title 16, page 20, display 24
- **Colour roles:** brand / danger / success / info, each with soft / line / text variants
- **On-brand text:** `--aw-on-brand`, which stays dark on the yellow fill in both themes

| Metric (5 web CSS files, token block excluded) | Before | After |
|---|---|---|
| Hex colour uses / distinct | 173 / 79 | 51 / 32 * |
| Raw `font-size` px values | 93 | 10 ** |
| Text under 12px (Thai floor) | 8 | **0** |
| Raw spacing declarations | 212 | 2 |
| Raw `border-radius` px | 55 | 0 |

\* The remaining hex values are mostly the existing hand-tuned dark-mode rules, which were restored exactly from HEAD (see "Bugs found during the check").
\*\* What remains is in `font:` shorthands for the page headings.

## Pass 2: shell

- **Refresh button removed:**
  - `AgentWorkspacePage` no longer takes or renders the refresh button.
  - The `RefreshIcon` and its toolbar CSS (`aw-page-toolbar`, `aw-page-refresh`, `aw-spin`) were deleted.
  - The test now checks that there is no refresh button anywhere.
- **Generic page subtitle hidden:** "พื้นที่ทำงานนายหน้า / ผู้ให้เช่า / ผู้เช่า" is already in the sidebar switcher. Meaningful subtitles still show.
- **Role dot → ring:** the role colour is now a thin ring around the switcher tile (`--aw-role`). A filled red dot read as an alert.
- **Duplicate heading removed:** the "Dashboard" eyebrow above "สวัสดี, …" is gone. The top bar already says Dashboard.

## Pass 3: dashboard

- **To-do first:** "งานที่ต้องทำ" + "นัดหมายวันนี้" now come before the KPIs.
  - To-do is the wider card (1.6 : 1).
  - Below a 1040px container it becomes full width, first.
  - At 1024 the to-do list is now above the fold. It used to be below five KPI cards.
- **KPI strip:** 4 cards instead of 5, smaller (24px values, tighter padding).
  - Commission left the strip; it already has its own card in the money row.
- **Cards keep their own height** (`align-items: start`). A short card no longer stretches to match its neighbour.
- **Empty cards use the shared `WebState`** (compact), with a next step:
  - No appointments → "ดูปฏิทิน"
  - No rooms → "เพิ่มห้อง"
  - Load errors keep the existing retry.

## Bugs found during the check (fixed)

1. **Dark mode lost contrast after pass 1.** Seen in the after screenshots:
   - "+ สร้าง" in the top bar became dark on dark.
   - "เพิ่มห้อง" text became light on yellow.
   - "ดูปฏิทิน" links and the to-do count went dim.

   Root cause: the token pass also mapped the hex values inside existing `[data-theme="dark"]` rules to tokens that have their own dark overrides, so they were translated twice.

   Fix:
   - All 18 dark-scoped rules were restored exactly from HEAD.
   - Text on the yellow fill uses the new `--aw-on-brand`.
2. **Sidebar labels wrapped at 1024** ("คลัง / สัญญา", "ค่า / คอมมิชชั่น"). The coming-soon badge grew from 9px to 12px (Thai floor) inside a 216px sidebar.

   Fix: the badge is now plain muted text with no box, and those rows have a tighter gap. The groups themselves are unchanged (decision 2).
3. **Cleanup:** the `var(--aw-x, var(--aw-x))` self-fallbacks left by the token script (in `ui/agent-web-ui.css`, `web-notifier.css` and the footer CSS) were reduced to `var(--aw-x)`.

## Before / after (QA Agent account, with data)

| View | Before | After |
|---|---|---|
| Dashboard 1440 light, top | `with-data/dashboard-1440-top.jpg` | `after/dashboard-1440-top.jpg` |
| Dashboard 1440 light, middle | `with-data/dashboard-1440-middle.jpg` | `after/dashboard-1440-middle.jpg` |
| Dashboard 1440 dark | `before/dashboard-1440-dark.jpg` (empty account) | `after/dashboard-1440-dark.jpg` |
| Dashboard 1024 | `with-data/dashboard-1024.jpg` | `after/dashboard-1024.jpg` |
| Dashboard 390 (app UI, unchanged by design) | — | `after/dashboard-390.jpg` |

The empty-account AFTER set was not captured: the browser is signed in as QA Agent only. Sign-in has to be done by Mos.

## Checks

- `node --test`: 398 / 398 pass
- `tsc --noEmit`: 0 errors
- `check:roles`: OK
- Mobile (`.tsx`) files: untouched. The 390 view is the app UI, as before.

## Changed files (uncommitted)

- `components/agent-web/AgentWorkspace.web.tsx`
- `AgentSectionHeader.web.tsx`
- `AgentOverview.web.tsx`
- `agent-workspace.css`
- `agent-overview.css`
- `agent-workspace-footer.css`
- `ui/agent-web-ui.css`
- `components/web-notify/web-notifier.css`
- Tests:
  - `components/agent-workspace.test.cjs` (refresh test rewritten)
  - `components/agent-overview.test.cjs` (KPI count 5 → 4)

## Still open (next plan steps)

- **Step 4:** list pages on `WebTable` + tokens:
  - Rooms: 4-column grid at 1440, key-tag label, readiness column.
  - Leads: neutral/green match colour, one "ข้อมูลไม่พอ" hint instead of one per row.
  - Tenants: full width.
- **Steps 5–7:** forms → account pages + account card above role → A8 + D-B pages.
