// src/state/slices/camera.slice.ts
// Maintains the main canvas camera with bounded, fit-relative, anchor-preserving zoom.

import type { AppState, Point } from "../types";
import { computeMinimumCanvasZoom, constrainCanvasZoomCamera } from "../canvasZoomBounds";

export const MIN_CANVAS_ZOOM = 0.001;
export const MAX_CANVAS_ZOOM = 12;

const DEFAULT_CANVAS_FIT_ZOOM = 1;

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

function positiveFiniteOrDefault( value: number, fallback: number ): number {
    return Number.isFinite( value ) && value > 0 ? value : fallback;
}

function clampZoomRelativeToFit( zoom: number, fitZoom: number, minimumZoom: number ): number {
    const safeFitZoom = positiveFiniteOrDefault( fitZoom, DEFAULT_CANVAS_FIT_ZOOM );
    const floor = Math.max( safeFitZoom * MIN_CANVAS_ZOOM, minimumZoom );
    return Math.min(
        Math.max( safeFitZoom, floor ) * MAX_CANVAS_ZOOM,
        Math.max( floor, zoom )
    );
}

export const cameraSlice = ( set: SetState, get: () => AppState ) =>
( {
    canvasFitZoom: DEFAULT_CANVAS_FIT_ZOOM,
    canvasZoomBounds: null,
    canvasFitRequest: 0,
    canvasFitAppliedRequest: 0,

    setCanvasZoomBounds: bounds => {
        const state = get();
        const camera = state.drag.active ? state.panzoom : constrainCanvasZoomCamera( state.panzoom, bounds );
        const previous = state.canvasZoomBounds;
        const isSameBounds = previous === bounds || ( previous !== null && bounds !== null
            && previous.geometry.x === bounds.geometry.x && previous.geometry.y === bounds.geometry.y
            && previous.geometry.width === bounds.geometry.width && previous.geometry.height === bounds.geometry.height
            && previous.viewport.x === bounds.viewport.x && previous.viewport.y === bounds.viewport.y
            && previous.viewport.width === bounds.viewport.width && previous.viewport.height === bounds.viewport.height );
        if ( isSameBounds && camera.x === state.panzoom.x && camera.y === state.panzoom.y && camera.zoom === state.panzoom.zoom ) return;
        set( { canvasZoomBounds: bounds, panzoom: camera } );
    },

    setPan: ( dx: number, dy: number ) => {
        const state = get();
        const pz = state.panzoom;
        set( { panzoom: constrainCanvasZoomCamera( { ...pz, x: pz.x + dx, y: pz.y + dy }, state.canvasZoomBounds ) } );
    },

    setCanvasCamera: ( panzoom: AppState[ "panzoom" ], fitZoom: number, appliedFitRequest?: number ) => {
        const safeFitZoom = positiveFiniteOrDefault( fitZoom, DEFAULT_CANVAS_FIT_ZOOM );
        if ( !Number.isFinite( panzoom.x ) || !Number.isFinite( panzoom.y ) || !Number.isFinite( panzoom.zoom ) ) {
            console.warn( "[Canvas camera] Ignored a non-finite camera update.", { panzoom, fitZoom } );
            return;
        }

        const bounds = get().canvasZoomBounds;
        const clampedZoom = clampZoomRelativeToFit( panzoom.zoom, safeFitZoom, computeMinimumCanvasZoom( bounds ) );
        set( current => ( {
            canvasFitZoom: safeFitZoom,
            canvasFitAppliedRequest: appliedFitRequest == null
                ? current.canvasFitAppliedRequest
                : Math.max( current.canvasFitAppliedRequest, appliedFitRequest ),
            panzoom: constrainCanvasZoomCamera( {
                x: panzoom.x,
                y: panzoom.y,
                zoom: clampedZoom,
            }, bounds ),
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
        const minimumZoom = computeMinimumCanvasZoom( state.canvasZoomBounds );
        if ( Math.round( requestedPercent ) === 100 && minimumZoom <= fitZoom ) {
            const nextRequest = state.canvasFitRequest + 1;
            set( { canvasFitRequest: nextRequest } );
            return;
        }

        const clamped = clampZoomRelativeToFit( newZoom, fitZoom, minimumZoom );
        if ( clamped === pz.zoom ) return;
        const panX = pz.x + ( pz.zoom - clamped ) * anchor.x;
        const panY = pz.y + ( pz.zoom - clamped ) * anchor.y;
        set( { panzoom: constrainCanvasZoomCamera( { x: panX, y: panY, zoom: clamped }, state.canvasZoomBounds ) } );
    },
} satisfies Partial<AppState> );
