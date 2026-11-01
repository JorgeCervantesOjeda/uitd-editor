// src/components/Canvas/visibleCanvasPan.test.ts
// Unit cases linked to visibleCanvasPan.integration and canvas pan system coverage.
import { describe, expect, it } from "vitest";
import { constrainVisiblePan } from "./visibleCanvasPan";

const viewport = { left: 0, top: 0, right: 900, bottom: 600 };
const box = { left: 200, top: 150, right: 700, bottom: 450 };

describe( "constrainVisiblePan", () => {
    it( "allows movement until one third of the viewport is exposed", () => {
        expect( constrainVisiblePan( viewport, [ box ], 1000, 0 ) ).toEqual( { x: 100, y: 0 } );
        expect( constrainVisiblePan( viewport, [ box ], -1000, 0 ) ).toEqual( { x: -100, y: 0 } );
        expect( constrainVisiblePan( viewport, [ box ], 0, 1000 ) ).toEqual( { x: 0, y: 50 } );
        expect( constrainVisiblePan( viewport, [ box ], 0, -1000 ) ).toEqual( { x: 0, y: -50 } );
    } );

    it.each( [
        [ 1000, 1000, 100, 50 ],
        [ -1000, 1000, -100, 50 ],
        [ 1000, -1000, 100, -50 ],
        [ -1000, -1000, -100, -50 ],
    ] )( "bounds each axis independently for diagonal input %s,%s", ( dx, dy, x, y ) => {
        expect( constrainVisiblePan( viewport, [ box ], dx, dy ) ).toEqual( { x, y } );
    } );

    it( "reaches a third horizontally instead of stopping at a quarter with vertical saturation", () => {
        const screen = { left: 0, top: 0, right: 1200, bottom: 900 };
        const body = { left: 250, top: 250, right: 1100, bottom: 850 };
        const diagonal = constrainVisiblePan( screen, [ body ], 300, 300 );
        expect( diagonal ).toEqual( { x: 150, y: 50 } );
        expect( ( body.left + diagonal.x ) / screen.right ).toBeCloseTo( 1 / 3 );
        expect( constrainVisiblePan( screen, [ { ...body, top: 300, bottom: 900 } ], 300, 300 ) )
            .toEqual( { x: 150, y: 0 } );
    } );

    it( "ignores distant elements when deriving the current margin", () => {
        expect( constrainVisiblePan( viewport, [ box, { left: -5000, right: -4500, top: 0, bottom: 100 } ], 1000, 0 ) )
            .toEqual( { x: 100, y: 0 } );
    } );

    it( "allows a small element to move toward the center without snapping", () => {
        const small = { left: 440, right: 460, top: 290, bottom: 310 };
        expect( constrainVisiblePan( viewport, [ small ], 100, 0 ) ).toEqual( { x: 100, y: 0 } );
        expect( constrainVisiblePan( viewport, [ small ], 1000, 0 ) ).toEqual( { x: 150, y: 0 } );
        const nearEdge = { ...small, left: 800, right: 820 };
        expect( constrainVisiblePan( viewport, [ nearEdge ], -100, 0 ) ).toEqual( { x: -100, y: 0 } );
    } );

    it( "does not cross an empty diagonal gap inside the overall bounding box", () => {
        const corners = [
            { left: -100, right: 100, top: 450, bottom: 650 },
            { left: 800, right: 1000, top: -100, bottom: 100 },
        ];
        const delta = constrainVisiblePan( viewport, corners, 1000, 1000 );
        expect( delta.x ).toBeLessThan( 200 );
        expect( delta.y ).toBeLessThan( 150 );
        for ( let indexOfStep = 0; indexOfStep <= 20; indexOfStep++ ) {
            const fraction = indexOfStep / 20;
            expect( corners.some( body => body.left + delta.x * fraction < viewport.right
                && body.right + delta.x * fraction > viewport.left
                && body.top + delta.y * fraction < viewport.bottom
                && body.bottom + delta.y * fraction > viewport.top ) ).toBe( true );
        }
    } );

    it( "keeps an empty canvas movable", () => {
        expect( constrainVisiblePan( viewport, [], 20, 30 ) ).toEqual( { x: 20, y: 30 } );
    } );

    it( "discovers neighboring content and recalculates the margin on the next movement", () => {
        const bodies = [ box, { left: 950, right: 1450, top: 150, bottom: 450 } ];
        const first = constrainVisiblePan( viewport, bodies, -100, 0 );
        expect( first ).toEqual( { x: -100, y: 0 } );
        const moved = bodies.map( body => ( { ...body, left: body.left + first.x, right: body.right + first.x } ) );
        expect( constrainVisiblePan( viewport, moved, -200, 0 ) ).toEqual( { x: -200, y: 0 } );
    } );
} );
