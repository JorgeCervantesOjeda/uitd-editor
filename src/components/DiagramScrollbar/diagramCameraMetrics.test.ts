import { describe, expect, it } from "vitest";
import {
    cameraOffsetOfScroll,
    clampScroll,
    computeAxisScrollMetrics,
    computeFitToWidthCamera,
    effectiveZoomOfPercent,
    normalizeWheelDelta,
    zoomPercentOfEffectiveZoom,
} from "./diagramCameraMetrics";

describe( "diagramCameraMetrics", () => {
    it( "clamps scroll offsets to the available range", () => {
        expect( clampScroll( -100, 500 ) ).toBe( 0 );
        expect( clampScroll( 900, 500 ) ).toBe( 500 );
    } );

    it( "maps zoom percentages relative to the fit zoom", () => {
        expect( effectiveZoomOfPercent( 100, 0.42 ) ).toBeCloseTo( 0.42 );
        expect( effectiveZoomOfPercent( 200, 0.42 ) ).toBeCloseTo( 0.84 );
        expect( zoomPercentOfEffectiveZoom( 0.84, 0.42 ) ).toBeCloseTo( 200 );
    } );

    it( "fits to the available width and exposes the padded top-left edge", () => {
        const fit = computeFitToWidthCamera( {
            geometry: { x: 10, y: 20, width: 400, height: 300 },
            visibleLeft: 0,
            visibleTop: 0,
            visibleWidth: 840,
            paddingX: 20,
            paddingY: 30,
        } );

        expect( fit ).not.toBeNull();
        expect( fit!.fitZoom ).toBeCloseTo( 2 );
        expect( fit!.camera.x + 10 * fit!.fitZoom ).toBeCloseTo( 20 );
        expect( fit!.camera.y + 20 * fit!.fitZoom ).toBeCloseTo( 30 );
    } );

    it( "keeps scrollbar movement independent from zoom and round-trips camera offsets", () => {
        const initialMetrics = computeAxisScrollMetrics( {
            geometryStart: 10,
            geometrySize: 100,
            cameraOffset: -20,
            zoom: 2,
            visibleStart: 0,
            visibleSize: 50,
        } );

        expect( initialMetrics ).not.toBeNull();
        expect( initialMetrics!.maxOffset ).toBe( 150 );
        expect( initialMetrics!.offset ).toBe( 0 );

        const cameraBefore = { x: -20, y: 7, zoom: 2 };
        const cameraAfter = {
            ...cameraBefore,
            x: cameraOffsetOfScroll( initialMetrics!, 60 ),
        };

        expect( cameraAfter.zoom ).toBe( cameraBefore.zoom );

        const movedMetrics = computeAxisScrollMetrics( {
            geometryStart: 10,
            geometrySize: 100,
            cameraOffset: cameraAfter.x,
            zoom: cameraAfter.zoom,
            visibleStart: 0,
            visibleSize: 50,
        } );

        expect( movedMetrics?.offset ).toBe( 60 );
    } );

    it( "normalizes mouse-wheel and trackpad deltas for both scrollbar orientations", () => {
        expect( normalizeWheelDelta( { deltaX: 2, deltaY: 20, deltaMode: 0 }, "horizontal", 500 ) ).toBe( 20 );
        expect( normalizeWheelDelta( { deltaX: 40, deltaY: 5, deltaMode: 0 }, "horizontal", 500 ) ).toBe( 40 );
        expect( normalizeWheelDelta( { deltaX: 0, deltaY: 1, deltaMode: 2 }, "vertical", 500 ) ).toBe( 500 );
    } );
} );
