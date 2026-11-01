// src/state/slices/camera.slice.integration.test.ts
// Real-store zoom integration linked to canvasZoomBounds units and verify-canvas-zoom system checks.
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store";

const bounds = {
    geometry: { x: 0, y: 0, width: 600, height: 300 },
    viewport: { x: 0, y: 0, width: 900, height: 600 },
};

describe( "canvas camera zoom limits", () => {
    beforeEach( () => {
        useAppStore.setState( {
            canvasZoomBounds: null, canvasFitZoom: 1, panzoom: { x: 150, y: 150, zoom: 1 },
        } );
    } );

    it( "clamps wheel/slider requests and repeated zoom-out at the dynamic floor", () => {
        useAppStore.getState().setCanvasZoomBounds( bounds );
        for ( let indexOfRequest = 0; indexOfRequest < 100; indexOfRequest++ ) {
            useAppStore.getState().setZoomAnchored( 0.001, { x: 1000, y: -1000 } );
        }
        expect( useAppStore.getState().panzoom.zoom ).toBeCloseTo( 2 / 3 );
        expect( useAppStore.getState().panzoom.y ).toBeCloseTo( 200 );
    } );

    it( "enforces the same floor on direct camera updates and viewport resizing", () => {
        useAppStore.getState().setCanvasZoomBounds( bounds );
        useAppStore.getState().setCanvasCamera( { x: 0, y: 0, zoom: 0.001 }, 1 );
        expect( useAppStore.getState().panzoom.zoom ).toBeCloseTo( 2 / 3 );
        useAppStore.getState().setCanvasZoomBounds( {
            ...bounds, viewport: { ...bounds.viewport, height: 900 },
        } );
        expect( useAppStore.getState().panzoom.zoom ).toBe( 1 );
    } );

    it( "releases the dynamic limit when the diagram is removed", () => {
        useAppStore.getState().setCanvasZoomBounds( bounds );
        useAppStore.getState().setCanvasZoomBounds( null );
        useAppStore.getState().setZoomAnchored( 0.01, { x: 0, y: 0 } );
        expect( useAppStore.getState().panzoom.zoom ).toBe( 0.01 );
    } );

    it( "does not let panning undo the one-third margins at the zoom floor", () => {
        useAppStore.getState().setCanvasZoomBounds( bounds );
        useAppStore.getState().setZoomAnchored( 0.001, { x: 300, y: 150 } );
        useAppStore.getState().setPan( 1000, 1000 );
        expect( useAppStore.getState().panzoom.x ).toBeLessThanOrEqual( 300 );
        expect( useAppStore.getState().panzoom.y ).toBeCloseTo( 200 );
    } );

    it( "retains zoom-in headroom when the dynamic floor exceeds the old maximum", () => {
        useAppStore.getState().setCanvasZoomBounds( {
            ...bounds, geometry: { x: 0, y: 0, width: 10000, height: 10 },
        } );
        useAppStore.getState().setCanvasCamera( { x: 0, y: 0, zoom: 20 }, 0.1 );
        useAppStore.getState().setZoomAnchored( 40, { x: 300, y: 5 } );
        expect( useAppStore.getState().panzoom.zoom ).toBe( 40 );
    } );
} );
