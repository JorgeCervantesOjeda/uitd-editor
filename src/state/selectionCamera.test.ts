import { describe, expect, it } from "vitest";
import { centerCameraOfSelection, selectionRectOf } from "./selectionCamera";

const state = {
    nodes: [ { id: 1, title: "First", x: 100, y: 100 } ],
    actions: [],
    conditions: [],
    viewBox: { w: 800, h: 600 },
    canvasFitZoom: 1,
};

describe( "selectionCamera", () => {
    it( "uses the same selection rectangle as text-editor reveal", () => {
        expect( selectionRectOf( state, {
            nodes: new Set( [ 1 ] ),
            actions: new Set(),
            conditions: new Set(),
        } ) ).toEqual( { x: 65.5, y: 80, w: 69, h: 40 } );
    } );

    it( "centers the selection inside 80 percent of the viewBox", () => {
        const camera = centerCameraOfSelection( state, {
            nodes: new Set( [ 1 ] ),
            actions: new Set(),
            conditions: new Set(),
        } );

        expect( camera ).not.toBeNull();
        expect( camera!.zoom ).toBeCloseTo( 800 * 0.8 / 69 );
        expect( camera!.x + camera!.zoom * 100 ).toBeCloseTo( 400 );
        expect( camera!.y + camera!.zoom * 100 ).toBeCloseTo( 300 );
        expect( camera!.zoom * 69 ).toBeCloseTo( 640 );
        expect( camera!.zoom * 40 ).toBeLessThan( 480 );
    } );

    it( "returns no camera for an empty selection", () => {
        expect( centerCameraOfSelection( state, {
            nodes: new Set(),
            actions: new Set(),
            conditions: new Set(),
        } ) ).toBeNull();
    } );
} );
