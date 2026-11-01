// src/components/Canvas/visibleCanvasPan.integration.test.ts
// DOM/camera integration for visibleCanvasPan unit cases; system coverage: scripts/verify-canvas-pan.mjs.
import { describe, expect, it, vi } from "vitest";
import { constrainCanvasPan } from "./visibleCanvasPan";

describe( "visible canvas pan DOM integration", () => {
    it( "measures only fragment frames and converts SVG deltas", () => {
        document.body.innerHTML = '<div class="canvas"><div class="topToolbar"></div><svg><g data-diagram-content="true">'
            + '<g data-layer="fragment-frames"><g class="fragmentFrameGroup">'
            + '<rect data-fragment-selection="partial-or-none"/><rect data-export="ignore"/></g></g>'
            + '<g data-kbd-kind="node"><rect/><rect data-export="ignore"/></g>'
            + '<g data-kbd-kind="action"><ellipse/></g>'
            + '<g data-kbd-kind="condition"><polygon/></g></g></svg></div>';
        const svg = document.querySelector( "svg" )!;
        Object.assign( svg, { getScreenCTM: () => ( { a: 2, b: 0, c: 0, d: 2 } ) } );
        vi.spyOn( svg, "getBoundingClientRect" ).mockReturnValue( { left: 0, right: 900, top: 0, bottom: 600 } as DOMRect );
        vi.spyOn( document.querySelector( ".topToolbar" )!, "getBoundingClientRect" )
            .mockReturnValue( { bottom: 60 } as DOMRect );
        for ( const body of svg.querySelectorAll( "rect, ellipse, polygon" ) ) {
            vi.spyOn( body, "getBoundingClientRect" ).mockReturnValue( {
                left: 350, right: 550, top: 240, bottom: 360,
                width: 200, height: 120,
            } as DOMRect );
        }
        vi.mocked( svg.querySelector( '[data-fragment-selection]' )!.getBoundingClientRect ).mockReturnValue( {
            left: 200, right: 700, top: 150, bottom: 450, width: 500, height: 300,
        } as DOMRect );
        expect( constrainCanvasPan( svg, 1000, 0 ) ).toEqual( { x: 50, y: 0 } );
        expect( constrainCanvasPan( svg, 0, 1000 ) ).toEqual( { x: 0, y: 45 } );
        expect( constrainCanvasPan( svg, 1000, 1000 ) ).toEqual( { x: 50, y: 45 } );
    } );
} );
