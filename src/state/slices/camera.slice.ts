import type { AppState, Point } from "../types";

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const cameraSlice = ( set: SetState, get: () => AppState ) =>
( {
    setPan: ( dx: number, dy: number ) => {
        const pz = get().panzoom;
        set( { panzoom: { ...pz, x: pz.x + dx, y: pz.y + dy } } );
    },

    setZoomAnchored: ( newZoom: number, anchor: Point ) => {
        const pz = get().panzoom;
        const clamped = Math.min( 8.0, Math.max( 0.25, newZoom ) );
        if ( clamped === pz.zoom ) return;
        const panX = pz.x + ( pz.zoom - clamped ) * anchor.x;
        const panY = pz.y + ( pz.zoom - clamped ) * anchor.y;
        set( { panzoom: { x: panX, y: panY, zoom: clamped } } );
    },
} satisfies Partial<AppState> );
