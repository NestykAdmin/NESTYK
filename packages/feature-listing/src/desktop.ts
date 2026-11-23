// Browser-only entry point. Keep React Native components out of Next.js bundles.
export { RoomDesktopBody, type RoomDesktopBodyProps } from "./components/RoomDesktopBody";
export { PublicRoomDesktopBody } from "./components/PublicRoomDesktopBody";
export { toPublicRoomDetail, type PublicRoomShare } from "./public-room-share";
export { PublicRoomAreaMap, ROOM_AREA_RADIUS_METERS } from "./components/PublicRoomAreaMap";
// Map pieces for the guest search map (S4.3): the web app uses the Google Maps library through this package, so it
// needs no copy of its own, and the cookie gate stays one component.
export {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Circle,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  type MapCameraChangedEvent,
  type MapEvent,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
export { MapConsentGate, useMapsConsent } from "./components/MapConsentGate";
