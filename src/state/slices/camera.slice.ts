// src/state/slices/camera.slice.ts
// Maintains the main canvas camera with bounded, fit-relative, anchor-preserving zoom.

import type { AppState, Point } from "../types";

export const MIN_CANVAS_ZOOM = 0.001;
export const MAX_CANVAS_ZOOM = 12;

const DEFAULT_CANVAS_FIT_ZOOM = 1;

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

function positiveFiniteOrDefault( value: number, fallback: number ): number {
    return Number.isFinite( value ) && value > 0 ? value : fallback;
}

function clampZoomRelativeToFit( zoom: number, fitZoom: number ): number {
    const safeFitZoom = positiveFiniteOrDefault( fitZoom, DEFAULT_CANVAS_FIT_ZOOM );
    return Math.min(
        safeFitZoom * MAX_CANVAS_ZOOM,
        Math.max( safeFitZoom * MIN_CANVAS_ZOOM, zoom )
    );
}

export const cameraSlice = ( set: SetState, get: () => AppState ) =>
( {
    canvasFitZoom: DEFAULT_CANVAS_FIT_ZOOM,
    canvasFitRequest: 0,
    canvasFitAppliedRequest: 0,

    setPan: ( dx: number, dy: number ) => {
        const pz = get().panzoom;
        set( { panzoom: { ...pz, x: pz.x + dx, y: pz.y + dy } } );
    },

    setCanvasCamera: ( panzoom: AppState[ "panzoom" ], fitZoom: number, appliedFitRequest?: number ) => {
        const safeFitZoom = positiveFiniteOrDefault( fitZoom, DEFAULT_CANVAS_FIT_ZOOM );
        if ( !Number.isFinite( panzoom.x ) || !Number.isFinite( panzoom.y ) || !Number.isFinite( panzoom.zoom ) ) {
            console.warn( "[Canvas camera] Ignored a non-finite camera update.", { panzoom, fitZoom } );
            return;
        }

        const clampedZoom = clampZoomRelativeToFit( panzoom.zoom, safeFitZoom );
        set( current => ( {
            canvasFitZoom: safeFitZoom,
            canvasFitAppliedRequest: appliedFitRequest == null
                ? current.canvasFitAppliedRequest
                : Math.max( current.canvasFitAppliedRequest, appliedFitRequest ),
            panzoom: {
                x: panzoom.x,
                y: panzoom.y,
                zoom: clampedZoom,
            },
        } ) );
    },

    requestCanvasFitToWidth: () => {
        const nextRequest = get().canvasFitRequest + 1;
        set( { canvasFitRequest: nextRequest } );
        return nextRequest;
    },

    setZoomAnchored: ( newZoom: number, anchor: Point ) => {
        const state = get();
        const pz = state.panzoom;
        const fitZoom = positiveFiniteOrDefault( state.canvasFitZoom, DEFAULT_CANVAS_FIT_ZOOM );
        const requestedPercent = newZoom / fitZoom * 100;

        // The UI must never display a non-canonical rounded 100%.
        if ( Math.round( requestedPercent ) === 100 ) {
            const nextRequest = state.canvasFitRequest + 1;
            set( { canvasFitRequest: nextRequest } );
            return;
        }

        const clamped = clampZoomRelativeToFit( newZoom, fitZoom );
        if ( clamped === pz.zoom ) return;
        const panX = pz.x + ( pz.zoom - clamped ) * anchor.x;
        const panY = pz.y + ( pz.zoom - clamped ) * anchor.y;
        set( { panzoom: { x: panX, y: panY, zoom: clamped } } );
    },
} satisfies Partial<AppState> );
