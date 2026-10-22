# Global web content container

Web pages use the centered layout from `packages/ui/src/shells/WebContentContainer.tsx`.
This policy applies only to websites. The Expo root checks `Platform.OS === 'web'`;
iOS and Android render their existing route directly without this container.
The `/login` route is explicitly excluded and keeps its full-screen login layout.
The selected design is the centered container, with these shared defaults:

- Content width: at most **1,200 px**, excluding the outer gutters.
- Horizontal gutters: **32 px** on desktop, **24 px** up to 1,100 px, and **16 px** up to 760 px.
- Dashboard section gap: **16 px**.
- Navigation, workspace sidebars, and full-screen overlays sit outside the content boundary.

Change the defaults in **one place**: `packages/ui/src/shells/web-content-container.css`.
Do not copy these dimensions into individual pages or create a second page-wide `max-width`.
Forms, dialogs, and other deliberately narrow content may keep their own smaller inner width.
Wide tables should scroll inside their own region rather than widening the page.

## Automatic coverage

| Application | Layout owner |
| --- | --- |
| Expo web: every current and future route except `/login` | `apps/consumer-app/app/_layout.tsx` → `WebContentRoot` |
| Expo web: every Agent menu and its create/detail screens | `AgentWorkspace.web.tsx` → `WebContentContainer` |
| Expo web: other roles | The web fallback in `AgentWorkspace.web.tsx` → `WebContentContainer` |
| Next.js Marketplace and Agent / Owner / Admin portals | `WebPageLayout` → `WebContentContainer` |
| Next.js standalone public routes and future pages | `apps/web/app/layout.tsx` → `WebContentRoot` |

New pages under these layouts only return their page body. They do **not** need to import
or add another container. Agent menus continue to render into the existing workspace body slot.

`WebContentRoot` is a route-level fallback. When a workspace renders an explicit
`WebContentContainer`, the root delegates to it using a CSS `:has()` rule. The root's two
wrappers become `display: contents`, keeping the app chrome full width and preventing
double gutters. Plain routes without a workspace keep the default root boundary automatically.

For a new custom web shell, place one `WebContentContainer` around its body slot, below
or beside its navigation. Use `fill` for a workspace with its own scrollable viewport;
the container preserves the existing scroll owner and does not introduce another scroll area.
For pages that own a scroll viewport, put a content container **inside** that viewport.
The outer `fill` container delegates to the inner boundary automatically. This keeps the
viewport and vertical scrollbar at the workspace's right edge while its content stays centered.
`MobileModePage`, Agent Overview, and the create forms already follow this pattern;
new pages using `MobileModePage` inherit it without extra wrappers. Do not cap the width of
the scroll viewport itself. A form's tabs and docked actions use sibling content containers
so they share the same alignment without scrolling with the form body.

```tsx
import { WebContentContainer } from '@nestyk/ui';

function CustomWebShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header>{/* full-width app navigation */}</header>
      <main>
        <WebContentContainer>{children}</WebContentContainer>
      </main>
    </div>
  );
}
```

Expo code imports the same API from `@nestyk/ui/native`; Metro resolves the web implementation
in a browser and the fragment-only `.native.tsx` implementation on iOS / Android. Native
screens retain their own padding and layout. `MobileModePage` leaves horizontal spacing to
the shared container on web, while preserving 16 px padding on native screens.

## Native layout boundary

When web scroll content needs an extra styled group, use `WebOnlyView` from
`@nestyk/ui/native`. Its `.web.tsx` implementation renders a styled `View`; its native
implementation returns only the original children. Keep native scroll content styles on
the existing `ScrollView`, and apply web-only grouping styles to `WebOnlyView`.
Do not add an unconditional `View` to a shared form just to arrange its web layout.

## Agent desktop screens

Rooms, Leads and Tenants keep their existing data controllers and native screen children.
`apps/consumer-app/components/agent-web/RecordPresentations.web.tsx` supplies the desktop
tables, search, filters and actions. The matching `.tsx` file passes native children through
unchanged. Keep API requests, paging and create/detail callbacks in the shared controllers.

Create forms use `WebFormSection`, `WebFormTabs` and `WebFormActions` from `@nestyk/ui/native`.
The `.web.tsx` implementation supplies the desktop step navigation, form card and docked
actions. The native implementation is fragment-only. The room wizard enables these desktop
slots only for `config.actorRole === 'agent'`. Form validation and submit handlers remain shared.
Agent lead select/location fields also have separate `.web.tsx` implementations so web
dropdowns do not open native-style full-screen selectors.

Wrap form sheets in `WebFormSheet` to present their shared contents in a centered web dialog
with focus containment and Escape dismissal. The native slot mounts the original sheet
unchanged. The room wizard enables this only for Agent; the tenant booking confirmation
uses the same slot. Keep visibility, validation, busy guards and submission in the existing
controllers.

## Agent web headings and controls

`AgentSectionHeader.web.tsx` supplies the compact heading, gold accent, page actions and
optional record count. Web list presentations publish their section/count through
`AgentPageHeaderContext`; the workspace scopes that metadata to the active page so it
cannot leak into a create or detail screen. Native headers and controllers are unchanged.

Use `AgentSelect` in Agent web components for the shared chevron: a 14 px inset and 44 px
text clearance. It keeps a native HTML select and its keyboard behavior. Composite search
and select fields own one rounded focus ring on the outer border; their inner inputs do
not draw a second outline. These styles are scoped to `.aw-shell` and are absent on native.

## Agent room details

`AgentRoomDetailModal.web.tsx` supplies a desktop dialog with the existing fetch, edit and
share API functions. Its native `.tsx` entry is unchanged. The feature package resolves
`MobileAgentRoomBody.web.tsx` to the desktop body on web and retains the original native
entry on iOS/Android. Keep their share/preview state transitions aligned; both use the same
share-completeness helper and `RoomShareLinkSheet` controller.

The desktop body owns the scroll viewport, with the shared content container inside it:
photo mosaic/lightbox, room sections and a sticky price/contract sidebar. Preview mode
respects the existing share visibility flags and excludes internal fields and listing IDs.
The share sheet uses a transparent native `WebFormSheet` slot and a centered dialog on web.
