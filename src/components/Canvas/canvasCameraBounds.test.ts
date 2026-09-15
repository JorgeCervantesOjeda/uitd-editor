// src/components/Canvas/canvasCameraBounds.test.ts
// Verifies that the canvas camera is clamped to measured scroll limits.

import { describe, expect, it } from "vitest";
import { clampedCanvasCameraOfScrollMetrics } from "./canvasCameraBounds";

describe( "canvasCameraBounds", () => {
    it( "clamps the canvas camera to horizontal and vertical scroll metrics", () => {
        const camera = clampedCanvasCameraOfScrollMetrics( {
            x: -9000,
            y: 9000,
            zoom: 2,
        }, {
            horizontal: {
                centerCameraOffset: 25,
                maxOffset: 700,
                offset: 700,
                startCameraOffset: -200,
            },
            vertical: {
                centerCameraOffset: 30,
                maxOffset: 900,
                offset: 0,
                startCameraOffset: 40,
            },
        } );

        expect( camera ).toEqual( {
            x: -900,
            y: 40,
            zoom: 2,
        } );
    } );

    it( "centers axes that have no remaining scroll range", () => {
        const camera = clampedCanvasCameraOfScrollMetrics( {
            x: -240,
            y: -320,
            zoom: 0.4,
        }, {
            horizontal: {
                centerCameraOffset: 180,
                maxOffset: 0,
                offset: 0,
                startCameraOffset: 16,
            },
            vertical: {
                centerCameraOffset: 90,
                maxOffset: 0,
                offset: 0,
                startCameraOffset: 24,
            },
        } );

        expect( camera ).toEqual( {
            x: 180,
            y: 90,
            zoom: 0.4,
        } );
    } );
} );
