// src/state/canvasZoomBounds.test.ts
// Zoom-margin unit cases linked to camera.slice integration and verify-canvas-zoom system checks.
import { describe, expect, it } from "vitest";
import { computeMinimumCanvasZoom, constrainCanvasZoomCamera } from "./canvasZoomBounds";

const bounds = {
    geometry: { x: 100, y: -100, width: 600, height: 300 },
    viewport: { x: 0, y: 60, width: 900, height: 600 },
};

describe( "canvas zoom margins", () => {
    it( "requires at least one third of both viewport dimensions", () => {
        expect( computeMinimumCanvasZoom( bounds ) ).toBeCloseTo( 2 / 3 );
    } );

    it( "raises zoom and positions content within one-third margins on all four sides", () => {
        const camera = constrainCanvasZoomCamera( { x: 9000, y: -9000, zoom: 0.001 }, bounds );
        expect( camera.zoom ).toBeCloseTo( 2 / 3 );
        expect( camera.x + bounds.geometry.x * camera.zoom ).toBeLessThanOrEqual( 300 );
        expect( camera.x + 700 * camera.zoom ).toBeGreaterThanOrEqual( 600 );
        expect( camera.y - 100 * camera.zoom ).toBeCloseTo( 260 );
        expect( camera.y + 200 * camera.zoom ).toBeCloseTo( 460 );
    } );

    it( "preserves a camera already satisfying the zoom and margins", () => {
        const camera = { x: 100, y: 200, zoom: 2 };
        expect( constrainCanvasZoomCamera( camera, bounds ) ).toEqual( camera );
    } );

    it( "prioritizes the margin in the short axis of a wide diagram", () => {
        expect( computeMinimumCanvasZoom( {
            ...bounds, geometry: { x: 0, y: 0, width: 10000, height: 10 },
        } ) ).toBe( 20 );
    } );

    it( "leaves the camera unchanged on an empty canvas", () => {
        const camera = { x: 10, y: 20, zoom: 0.01 };
        expect( computeMinimumCanvasZoom( null ) ).toBe( 0 );
        expect( constrainCanvasZoomCamera( camera, null ) ).toEqual( camera );
    } );
} );
