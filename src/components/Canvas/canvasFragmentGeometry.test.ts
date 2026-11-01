// src/components/Canvas/canvasFragmentGeometry.test.ts
// Fragment-only geometry units linked to visibleCanvasPan integration and verify-canvas-pan system checks.
import { describe, expect, it } from "vitest";
import { measureCanvasFragmentGeometry } from "./canvasFragmentGeometry";

describe( "fragment-only canvas geometry", () => {
    it( "ignores node bodies, titles and selection overlays when measuring frames", () => {
        document.body.innerHTML = '<svg><g data-diagram-content="true"><g data-layer="fragment-frames">'
            + '<g class="fragmentFrameGroup"><rect data-fragment-selection="complete"/>'
            + '<rect data-export="ignore"/><text>Title</text></g>'
            + '<g class="fragmentFrameGroup"><rect data-fragment-selection="partial-or-none"/></g>'
            + '</g><g data-kbd-kind="node"><rect/></g></g></svg>';
        const diagram = document.querySelector( '[data-diagram-content]' ) as SVGGElement;
        const frames = diagram.querySelectorAll( '[data-fragment-selection]' );
        Object.assign( frames[ 0 ], { getBBox: () => ( { x: -20, y: 30, width: 200, height: 100 } ) } );
        Object.assign( frames[ 1 ], { getBBox: () => ( { x: 300, y: -50, width: 100, height: 500 } ) } );
        expect( measureCanvasFragmentGeometry( diagram ) ).toEqual( { x: -20, y: -50, width: 420, height: 500 } );
    } );

    it( "returns no geometry when there are no fragment rectangles", () => {
        document.body.innerHTML = '<svg><g><rect/></g></svg>';
        expect( measureCanvasFragmentGeometry( document.querySelector( 'g' ) as SVGGElement ) ).toBeNull();
    } );
} );
