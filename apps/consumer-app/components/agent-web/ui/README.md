# Agent web · shared UI (`components/agent-web/ui`)

Web-only pieces for agent pages. Import from one place:

```ts
import { StatusBadge, StatusFilterChip, leadStatusIntent, WebPageHeader, WebCard, WebMenu, WebDialog } from "./ui";
```

Use the app's own components first (`MobileSegmentedTabs`, `MobileListSearchRow`, `MobileButton`, `RoomEditSectionList`, …). Add a piece here only when every page needs it and the app has nothing that fits.

## Which piece for what (design canvas → code)

| In the design | Use | Notes |
|---|---|---|
| Status capsule in a row/card (พร้อมให้เช่า, ใหม่, ค้างชำระ) | `<StatusBadge label intent />` | App's `MobileStatusPill` + intent colours. Text always; one coloured badge per row |
| Status filter chips above a list (ทั้งหมด / ใหม่ / … + count) | `<StatusFilterChip label count selected onPress intent? />` | App's `MobileFilterChip`. No `intent` = the "All" chip |
| Which colour a status gets | `roomStatusIntent`, `leadStatusIntent`, `billStatusIntent`, `tenantWorkIntent`, `viewingIntent` | Never pick colours by hand. New status → add it to the table in `statusIntent.ts` |
| Tabs งานค้าง / ผู้เช่าทั้งหมด, เดือน / รายการ | app's `MobileSegmentedTabs` | Not here — same as the app |
| Row under the top bar: breadcrumb · description · page buttons | `<WebPageHeader breadcrumb description actions />` | Breadcrumb shows only with 2+ crumbs (deep pages). Page title stays in the top bar |
| White card on grey background | `<WebCard title actions padding />` | `padding="none"` for tables |
| "+ สร้าง", language, row ⋯, account menu | `<WebMenu label trigger items />` | Esc / outside click / choosing closes it. `checked` makes a choice list (✓) |
| Quick view / confirm / short form over the page | `<WebDialog open title onClose footer size />` | Long or multi-step work = a page (add room, add lead, tenant detail) |
| A list as a table (rooms, leads, tenants) | `<WebTable label columns rows rowKey status sort onSortChange selectable … />` | States built in: `status="loading"` → skeleton · `"error"` → error + retry (offline when the browser is offline) · `"forbidden"` · no rows → empty, or "No matches" + "Clear filters" when `filtered`. Sort is the page's job: send it to the API, or `sortRows` for short lists. `nextSort` flips the direction |
| A whole page or card with nothing to show / an error / not found / no permission / offline | `<WebState kind onRetry onClearFilters onBack action />` | Default texts from `agent.dashboard.webStates`; pass `title` / `description` for a list's own words (e.g. "No leads yet") |
| Loading | `<WebSkeleton rows columns />` | Grey bars in the shape of the content, not a spinner |
| Online / offline | `useOnline()` | `WebTable` already uses it for its error state |

## The 5 intents

| intent | meaning | bg / text |
|---|---|---|
| `attn` | you must act | `#FFF3CC` / `#6B4A00` |
| `prog` | in progress, waiting on others | white + `#211E1E` border |
| `done` | ready, complete | `#EAF5EE` / `#1F6B43` |
| `neutral` | nothing to do, closed | `#F1F5F9` / `#475569` |
| `crit` | overdue, error, must fix (red only for these) | `#FDECEC` / `#B42318` |

## Rules

- Text comes from i18n (`t.…`), never typed into the component.
- Links and page changes go through `stateToRoute` (`lib/app-routes.ts`).
- Add a `testID` as `page.part` (e.g. `leads.statusFilter`); it becomes `data-testid` on web.
- No keyboard-shortcut hints in the UI.
- Tests: `components/agent-web-ui.test.cjs`.
