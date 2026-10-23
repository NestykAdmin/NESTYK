# Public room share website

The mobile Agent share flow is unchanged: the existing API creates a URL at
`PUBLIC_WEB_URL/s/[token]`. The recipient opens that URL in a browser; the
Next.js route `apps/web/app/s/[token]/page.tsx` fetches the existing public
room-share endpoint without an Agent session.

## Browser presentation

The route uses the browser-only `@nestyk/feature-listing/desktop` entry point:

- `PublicRoomDesktopBody` adapts the public response and supplies the DOM map.
- `RoomDesktopBody` renders the existing desktop photo mosaic/lightbox, room
  sections, facilities and price/contract sidebar.
- `toPublicRoomDetail` honors `shareSections`, drops private Agent fields and
  never calls the Agent room endpoint. The server still enforces link expiry
  and revocation and decides which contact is included.
- `WebContentContainer` from the isolated `@nestyk/ui/web-content` entry keeps
  the content at 1,200 px, with gutters of 32 px
  (desktop), 24 px (up to 1,100 px) and 16 px (up to 760 px). Only the share page
  uses this container on this branch; the app shells are unchanged.
- The public map reads `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Next.js can reuse the
  existing frontend `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` as a fallback. Without a
  key, the existing unavailable-map message and external map link remain.
- Public-page labels use `agent.roomDetail.publicShare` translations in Thai,
  English, Chinese and Japanese.

## Mobile boundary

No files in `apps/consumer-app`, native UI exports, mobile share controllers,
API services or database schemas are changed by this work. Native room details
continue to use `MobileAgentRoomBody.tsx` and `MobileRoomDetailBody.tsx`.
The desktop entry is separate from the package root consumed by the app.

`AgentRoomDesktopBody.tsx` is retained as a compatibility adapter from the
incoming changes. This branch does not wire it into the app, and it is not
exported from either the native root or the public desktop entry. The container
also has a transparent native fallback and is not added to either shared UI root.

When deploying, `PUBLIC_WEB_URL` must point to the reachable website, and the
web frontend must use the reachable API URL. Localhost links are only usable
on the computer hosting those services.

## Validation

Run the public share tests, browser/type checks and app/API checks required by
`AGENTS.md`. Native source maps should keep the existing room screens and
exclude the desktop/public presentation and its CSS. Existing translation
values must remain unchanged; the public-page namespace is additive.
