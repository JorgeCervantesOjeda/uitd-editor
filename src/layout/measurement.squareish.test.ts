// src/layout/measurement.squareish.test.ts
// Verifica que el acomodo de nodos contenidos use una distribución bidimensional.

import { describe, expect, it } from "vitest";
import { layoutChildrenSquareish } from "./measurement";

const childSizes = [
    { w: 60, h: 40 },
    { w: 60, h: 40 },
];

describe( "layoutChildrenSquareish", () => {
    it( "places two children together in the first row", () => {
        const result = layoutChildrenSquareish( { x: 0, y: 0 }, childSizes, {
            padX: 16,
            padTopY: 2,
            padBottomY: 14,
            gapX: 12,
            gapY: 12,
            minW: 60,
            minH: 70,
        } );

        expect( result.positions[ 0 ].y ).toBe( result.positions[ 1 ].y );
        expect( result.positions[ 0 ].x ).toBeLessThan( result.positions[ 1 ].x );
    } );

    it( "fills the grid by rows from left to right", () => {
        const result = layoutChildrenSquareish( { x: 0, y: 0 }, Array.from( { length: 5 }, () => ( { w: 60, h: 40 } ) ), {
            padX: 16,
            padTopY: 2,
            padBottomY: 14,
            gapX: 12,
            gapY: 12,
            minW: 60,
            minH: 70,
        } );

        expect( result.positions[ 0 ].y ).toBe( result.positions[ 1 ].y );
        expect( result.positions[ 0 ].x ).toBeLessThan( result.positions[ 1 ].x );
        expect( result.positions[ 2 ].y ).toBeGreaterThan( result.positions[ 1 ].y );
        expect( result.positions[ 2 ].x ).toBe( result.positions[ 0 ].x );
    } );

    it( "uses multiple rows and columns for larger groups", () => {
        const result = layoutChildrenSquareish( { x: 0, y: 0 }, Array.from( { length: 5 }, () => ( { w: 60, h: 40 } ) ), {
            padX: 16,
            padTopY: 2,
            padBottomY: 14,
            gapX: 12,
            gapY: 12,
            minW: 60,
            minH: 70,
        } );

        expect( new Set( result.positions.map( position => position.x ) ).size ).toBeGreaterThan( 1 );
        expect( new Set( result.positions.map( position => position.y ) ).size ).toBeGreaterThan( 1 );
    } );
} );
