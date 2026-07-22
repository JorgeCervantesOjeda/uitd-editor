// src/components/UITDLTextPanel/d2JpegExport.test.ts
// Verifies letter-sized raster dimensions and SVG viewBox cropping for D2 JPG export.

import { describe, expect, it } from "vitest";
import { croppedD2SVG, rasterSizeOfD2Crop } from "./d2JpegExport";

describe( "d2JpegExport", () => {
    it( "fits a landscape crop into a letter page at 300 DPI", () => {
        const rasterSize = rasterSizeOfD2Crop( { x: 10, y: 20, width: 400, height: 200 } );

        expect( rasterSize ).toEqual( {
            width: 3300,
            height: 1650,
            dpi: 300,
        } );
    } );

    it( "fits a portrait crop into a letter page at 300 DPI", () => {
        const rasterSize = rasterSizeOfD2Crop( { x: 10, y: 20, width: 200, height: 400 } );

        expect( rasterSize ).toEqual( {
            width: 1650,
            height: 3300,
            dpi: 300,
        } );
    } );

    it( "rewrites the SVG viewBox and pixel size to the crop", () => {
        const croppedSVG = croppedD2SVG(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><rect width="1000" height="500"/></svg>',
            { x: 25, y: 50, width: 250, height: 125 },
            { width: 3300, height: 1650, dpi: 300 }
        );
        const documentOfSVG = new DOMParser().parseFromString( croppedSVG, "image/svg+xml" );
        const svgElement = documentOfSVG.documentElement;

        expect( svgElement.getAttribute( "viewBox" ) ).toBe( "25 50 250 125" );
        expect( svgElement.getAttribute( "width" ) ).toBe( "3300" );
        expect( svgElement.getAttribute( "height" ) ).toBe( "1650" );
    } );
} );
