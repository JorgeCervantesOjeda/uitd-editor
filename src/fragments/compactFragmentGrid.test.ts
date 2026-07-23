// src/fragments/compactFragmentGrid.test.ts
// Verifies compact fragment grid placement for differently sized fragments.

import { describe, expect, it } from "vitest";
import type { FragmentBounds } from "./fragmentBounds";
import {
    compactFragmentBoundsToGrid,
    FRAGMENT_CELL_GAP_X,
    FRAGMENT_CELL_GAP_Y,
    FRAGMENT_GRID_GAP_X,
    FRAGMENT_GRID_GAP_Y,
} from "./compactFragmentGrid";

function fragment( id: string, x: number, y: number, w: number, h: number ): FragmentBounds {
    return {
        id,
        title: id,
        nodeIds: [],
        actionIds: [],
        conditionIds: [],
        x,
        y,
        w,
        h,
    };
}

describe( "compactFragmentBoundsToGrid", () => {
    it( "places variable-size fragments into packed grid cells", () => {
        const placements = compactFragmentBoundsToGrid( [
            fragment( "A", 900, 0, 100, 80 ),
            fragment( "B", 0, 0, 200, 50 ),
            fragment( "C", 500, 0, 160, 300 ),
            fragment( "D", 0, 500, 160, 60 ),
        ] );

        expect( placements ).toEqual( [
            { id: "B", x: 0, y: 55 },
            { id: "A", x: 50, y: 165 },
            { id: "C", x: 380, y: 0 },
            { id: "D", x: 20, y: 560 },
        ] );
    } );

    it( "keeps at least the configured gap between neighboring grid tracks", () => {
        const fragments = [
            fragment( "A", 0, 0, 120, 90 ),
            fragment( "B", 500, 0, 220, 70 ),
            fragment( "C", 0, 500, 80, 160 ),
            fragment( "D", 500, 500, 200, 100 ),
        ];
        const placementById = new Map(
            compactFragmentBoundsToGrid( fragments ).map( placement => [ placement.id, placement ] )
        );

        const leftColumnRight = Math.max(
            placementById.get( "A" )!.x + fragments[ 0 ].w,
            placementById.get( "C" )!.x + fragments[ 2 ].w
        );
        const rightColumnLeft = Math.min(
            placementById.get( "B" )!.x,
            placementById.get( "D" )!.x
        );
        const topRowBottom = Math.max(
            placementById.get( "A" )!.y + fragments[ 0 ].h,
            placementById.get( "B" )!.y + fragments[ 1 ].h
        );
        const bottomRowTop = Math.min(
            placementById.get( "C" )!.y,
            placementById.get( "D" )!.y
        );

        expect( rightColumnLeft - leftColumnRight ).toBeGreaterThanOrEqual( FRAGMENT_GRID_GAP_X );
        expect( bottomRowTop - topRowBottom ).toBeGreaterThanOrEqual( FRAGMENT_GRID_GAP_Y );
    } );

    it( "packs small fragments together when they fit in the largest-fragment cell", () => {
        const fragments = [
            fragment( "large", 0, 0, 400, 300 ),
            fragment( "small-a", 1000, 0, 100, 80 ),
            fragment( "small-b", 1200, 0, 110, 70 ),
            fragment( "small-c", 1400, 0, 90, 60 ),
        ];
        const placementById = new Map(
            compactFragmentBoundsToGrid( fragments ).map( placement => [ placement.id, placement ] )
        );
        const smallCellLeft = 400 + FRAGMENT_GRID_GAP_X;
        const smallCellRight = smallCellLeft + 400;
        const smallCellBottom = 300;

        for ( const smallFragment of fragments.slice( 1 ) ) {
            const placement = placementById.get( smallFragment.id )!;
            expect( placement.x ).toBeGreaterThanOrEqual( smallCellLeft );
            expect( placement.x + smallFragment.w ).toBeLessThanOrEqual( smallCellRight );
            expect( placement.y ).toBeGreaterThanOrEqual( 0 );
            expect( placement.y + smallFragment.h ).toBeLessThanOrEqual( smallCellBottom );
        }

        const smallA = placementById.get( "small-a" )!;
        const smallB = placementById.get( "small-b" )!;
        const smallC = placementById.get( "small-c" )!;

        expect( smallB.x - ( smallA.x + 100 ) ).toBe( FRAGMENT_CELL_GAP_X );
        expect( smallC.y - ( smallA.y + 80 ) ).toBe( FRAGMENT_CELL_GAP_Y );
    } );
} );
