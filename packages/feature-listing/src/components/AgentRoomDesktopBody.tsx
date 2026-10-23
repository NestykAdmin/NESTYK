import React from "react";
import type { MobileRoomDetailBodyProps } from "./MobileRoomDetailBody";
import { RoomDesktopBody } from "./RoomDesktopBody";
import { NearbyPlacesMap } from "./NearbyPlacesMap";

/** Expo web adapter; native room details keep their original component. */
export function AgentRoomDesktopBody(props: MobileRoomDetailBodyProps) {
  return <RoomDesktopBody {...props} renderNearbyMap={(mapProps) => <NearbyPlacesMap {...mapProps} />} />;
}
