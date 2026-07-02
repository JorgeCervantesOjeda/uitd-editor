// src/state/slices/camera.slice.ts
// Maintains the main canvas camera with bounded, anchor-preserving zoom.

import type { AppState, Point } from "../types";

export const MIN_CANVAS_ZOOM = 0.05;
export const MAX_CANVAS_ZOOM = 12;

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const cameraSlice = ( set: SetState, get: () => AppState ) =>
( {
    setPan: ( dx: number, dy: number ) => {
        const pz = get().panzoom;
        set( { panzoom: { ...pz, x: pz.x + dx, y: pz.y + dy } } );
    },

    setZoomAnchored: ( newZoom: number, anchor: Point ) => {
        const pz = get().panzoom;
        const clamped = Math.min( MAX_CANVAS_ZOOM, Math.max( MIN_CANVAS_ZOOM, newZoom ) );
        if ( clamped === pz.zoom ) return;
        const panX = pz.x + ( pz.zoom - clamped ) * anchor.x;
        const panY = pz.y + ( pz.zoom - clamped ) * anchor.y;
        set( { panzoom: { x: panX, y: panY, zoom: clamped } } );
    },
} satisfies Partial<AppState> );
