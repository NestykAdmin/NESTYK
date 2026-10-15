# Agent contact directory

The mobile Contacts chooser opens five directories, scoped to the signed-in agent.
Every row opens a profile that can be edited and saved. Search matches names and phone numbers.

| Directory | Membership |
|---|---|
| Owner | Contact whose owner-sourced rooms have no rental history |
| Landlord | Contact with current or past rental history; remains a Landlord when rooms become vacant |
| Co-Agent | Manually added co-agent, or contact linked to an agent-owned scout room sourced from `co_agent` |
| Lead | Room seeker who has not yet rented with this agent |
| Tenant | Current or former renter; remains a Tenant after expiry, termination, cancellation or move-out |

Owner/Landlord membership is per contact. Once any linked owner-sourced room has
rental history, that person appears only in Landlord, including when all their rooms
are vacant. `roomCount` counts all their linked owner-sourced rooms. The same historical
rental predicate is used for Landlord and Tenant: active occupancy, a recorded move-in,
or a qualifying current/past lease. Drafts and reservation documents alone do not qualify.

Lead/Tenant membership uses the existing linked `leads` and `tenants` records.
A tenant qualifies through an active occupancy, a recorded move-in, or a lease/renewal
in `active`, `expired` or `terminated` status. A cancelled lease/renewal still qualifies
when all three signatures remain recorded. Reservation documents, drafts and cancelled
unsigned agreements alone do not establish rental history. Existing rental history is
retained, so a former Tenant is not returned to the Lead contact directory.
This directory filter does not remove records from the operational Leads or Tenants screens.

## Lead/Tenant APIs

| Method | Path | Result |
|---|---|---|
| GET | `/agent/contacts/lead` | All Lead contacts |
| GET | `/agent/contacts/tenant` | All current/former Tenant contacts |
| GET | `/agent/contacts/:kind/:id` | Profile for `lead` or `tenant` |
| PATCH | `/agent/contacts/:kind/:id` | Update that linked person |

Lists return `{ id, name, phone, roomCount: 0 }[]`, sorted by name and ID. IDs are
namespaced by kind; a Lead ID and Tenant ID with the same number are different references.
Profiles return `{ id, name, phone, email, lineId, facebook, note }`.
PATCH accepts only the six editable profile fields. Name and phone cannot be blank;
email, LINE, Facebook and notes can be cleared with an empty string or null.
LINE permits 255 characters for renter contacts, consistent with lead contact channels.

Saves update shared name, first/last name, phone, email and note in the linked lead and
tenant rows in one transaction. LINE/Facebook remain in the lead contact channels;
other channels are preserved. Matching preferences, identity documents, rental states,
room bookings and issued contract snapshots are preserved.

All routes require an authenticated agent. Reads and writes reject foreign or missing
IDs with 404; unsupported kinds and invalid/spoofed profile fields return 400.

## Mobile navigation

The shared directory/detail keeps its RefreshControl mounted throughout opening,
loading, editing and saving. Pull refresh is ignored while editing, confirming or saving. This
avoids remounting ScrollView children and the previous flashing/repeated-loading bug.
Successful saves reload the current page and invalidate room, lead and tenant data.

Targeted checks: `renter-contacts.test.cjs`, `agent-contacts-api.test.cjs`,
`agent-contact-detail.test.cjs` and `contact-navigation.test.cjs`.

## Co-Agent APIs

- `GET /agent/rooms/co-agent-contacts` lists this agent's co-agents and their linked co-agent room counts.
- `POST /agent/rooms/co-agent-contacts` creates a co-agent without requiring a room.
- `GET/PATCH /agent/rooms/contacts/:id` reads/updates the canonical contact used by room details, listings and existing share links.

The Add Co-Agent button opens the shared profile form with required name/phone and optional
email, LINE, Facebook and notes. Cancel returns to the list without saving; save opens the
new profile and reloads the first list page. Duplicate phones within the same agent return
409 without overwriting another contact. Inputs use the existing contact field limits.

`contacts.is_co_agent` preserves manually added membership and is set when creating or
reusing contacts in co-agent-sourced rooms. The list also recognizes legacy co-agent room
links, scoped to the agent, and counts only those rooms. A contact can also be an Owner or
Landlord if linked to owner-sourced rooms. Apply
`supabase/migrations/20261015090000_co_agent_contacts.sql` before deploying the API;
it adds the flag and backfills existing eligible contacts. `co-agent-contacts.test.cjs`
covers standalone creation, legacy links, agent isolation, duplicates and shared updates.

## Contact action confirmation

All five directories require a confirmation modal before entering edit mode and before
saving changes. Saving a new Co-Agent requires a create confirmation after the form
passes validation. These dialogs use the shared `MobileBottomSheet`, with Confirm and
Cancel actions. Cancel, backdrop dismissal and Android back dismiss the confirmation
without discarding the draft or submitting a request. Save explains that linked pages
will receive the updated canonical details. Repeated confirmation cannot duplicate a write.

## API regression checks

`npm run test:agent-contacts -w @nestyk/api` runs the contact service checks.
Use `RUN_CONTACTS_DB_TEST=1 npm run test:agent-contacts -w @nestyk/api` to include
real HTTP, authentication/role guards and PostgreSQL checks. The opt-in integration
suite uses a fresh disposable schema with synthetic records; it never copies or updates
user records, and drops only its own schema on completion.

Coverage includes all five lists, scoped GET/PATCH, standalone Co-Agent POST,
401/403/404/400 responses, duplicate phone 409 responses, rollback of linked
Lead/Tenant writes and concurrent creation. Occupancy history is scoped to its creating
agent, like lease history. Clearing LINE/Facebook removes all stored values for that
channel so an older value cannot reappear; replacing a value retains secondary values
and unrelated channels. Marking an existing room contact as Co-Agent updates only the
membership flag, preserving concurrent profile edits. Reusing a contact by phone changes
only explicitly supplied fields, preserving concurrent edits to omitted fields. NUL-containing fields are rejected
with 400 before PostgreSQL is queried.

## Landlord room information

Landlord contact details include a read-only Room information section below the profile.
It shows all linked owner-sourced scout rooms for the current agent, including rooms that
are vacant again: project, room number, listing title, location, status, floor, area,
bedroom count and starting monthly rent. Normalized prices take precedence over legacy
JSON prices. Co-agent-sourced rooms and other agents' rooms are excluded.

`GET /agent/rooms/contacts/:id/rooms` returns these summaries, scoped to the agent
and canonical contact. Foreign/missing contacts return 404; invalid IDs return 400.
Owner contacts may also use the API; the mobile section currently appears for Landlord.
It exposes no identity, bank, contract or note fields. Empty and failed requests have
separate messages and retry. Refresh waits for profile and rooms; contact editing retains
the loaded room data and hides it from the form. No schema migration is required.

## Contact list pagination

All five mobile directories use the Lead menu pagination pattern: 20 contacts per page,
Previous/Next buttons and the current/total page number. The count is the full filtered
total. Search is debounced by 250 ms, runs on the server across all contacts, and resets
to page 1. Names match case-insensitively; phone searches ignore spaces and formatting.
SQL LIKE wildcards in user searches are treated literally.

The five list routes accept `q`, `page` (positive integer, default 1) and `limit`
(1-50, default 20). Supplying any of these returns
`{ items, total, page, limit }`. With no query parameters, the existing array response
is retained for older callers. Repeated, malformed and unsupported query parameters
return 400. Count and results use one SQL snapshot; out-of-range pages return an empty
items array with the correct total, and the mobile list moves to the last valid page.
The existing room picker `/agent/rooms/contacts` keeps its original array contract.

Opening a contact and returning preserves the page and query. Saves reload the page to
account for reordered/filtered people; creating a Co-Agent clears search and reloads page 1.
Late search responses cannot overwrite newer results. Pagination regression checks are in
`agent-contact-pagination.test.cjs`, `agent-contacts-api.test.cjs` and the PostgreSQL/HTTP
contact integration suite, which checks 45 records in each category across three pages.
