// src/components/UITDLTextPanel/d2CropGeometry.test.ts
// Verifies editable crop geometry for D2 SVG JPG selections.

import { describe, expect, it } from "vitest";
import { cropRectOfInteraction, movedCropRect, resizedCropRect } from "./d2CropGeometry";

const DIMENSIONS = { width: 100, height: 300 };

describe( "d2CropGeometry", () => {
    it( "moves a crop without leaving the diagram bounds", () => {
        expect( movedCropRect(
            { x: 20, y: 50, width: 30, height: 80 },
            { x: 90, y: 300 },
            DIMENSIONS
        ) ).toEqual( { x: 70, y: 220, width: 30, height: 80 } );
    } );

    it( "resizes a crop from a side", () => {
        expect( resizedCropRect(
            { x: 20, y: 50, width: 30, height: 80 },
            "e",
            { x: 70, y: 200 },
            DIMENSIONS
        ) ).toEqual( { x: 20, y: 50, width: 50, height: 80 } );
    } );

    it( "resizes a crop from a corner and allows crossing the original corner", () => {
        expect( resizedCropRect(
            { x: 20, y: 50, width: 30, height: 80 },
            "nw",
            { x: 80, y: 180 },
            DIMENSIONS
        ) ).toEqual( { x: 50, y: 130, width: 30, height: 50 } );
    } );

    it( "derives a crop from an edit interaction", () => {
        expect( cropRectOfInteraction( {
            pointerId: 1,
            mode: "move",
            start: { x: 30, y: 60 },
            current: { x: 40, y: 90 },
            cropAtStart: { x: 20, y: 50, width: 30, height: 80 },
        }, DIMENSIONS ) ).toEqual( { x: 30, y: 80, width: 30, height: 80 } );
    } );
} );
