// Route plan R1 (Mos 3 Nov 2026): every path that is not "/", login or register lands here.
// Web: app paths are drawn by WebAppHost in the root layout (CatchAllRoute.web.tsx returns null for them).
// Mobile: "Unmatched" as before (CatchAllRoute.tsx).
export { default } from '../components/web-routes/CatchAllRoute';
