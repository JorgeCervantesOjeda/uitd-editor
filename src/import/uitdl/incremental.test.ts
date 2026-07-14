// src/import/uitdl/incremental.test.ts
// Verifies incremental UITDL reconciliation preserves visual identity and materializes only transitions.

import { describe, expect, it } from "vitest";
import type { AppState } from "../../state/types";
import { reconcileUITDLTextIncrementally } from "./incremental";

function baseState( patch: Partial<AppState> = {} ): AppState {
    return {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        fragmentTitles: {},
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        panzoom: { x: 0, y: 0, zoom: 1 },
        viewBox: { w: 1000, h: 800 },
        ...patch,
    } as AppState;
}

describe( "reconcileUITDLTextIncrementally", () => {
    it( "does not materialize declared actions that are not used by transitions", () => {
        const text = `UITD "Declared action" {
            UI 1 "Start" actions {
                clicks "Unused";
            }
            FRAGMENT "Only UI" {
                DRAW { 1 };
            }
        }`;

        const result = reconcileUITDLTextIncrementally( text, baseState() );

        expect( result.nodes ).toHaveLength( 1 );
        expect( result.actions ).toHaveLength( 0 );
        expect( result.edges ).toHaveLength( 0 );
    } );

    it( "preserves node identity and position for equivalent UIIDs", () => {
        const text = `UITD "Rename" {
            UI 1 "Renamed" actions {}
            FRAGMENT "Only UI" {
                DRAW { 1 };
            }
        }`;

        const result = reconcileUITDLTextIncrementally( text, baseState( {
            nodes: [ {
                id: 12,
                displayId: "1",
                title: "Old",
                x: 300,
                y: 220,
                w: 100,
                h: 70,
                parentId: null,
                colorFill: "#112233",
            } ],
            nextId: 13,
        } ) );

        expect( result.nodes[ 0 ].id ).toBe( 12 );
        expect( result.nodes[ 0 ].x ).toBe( 300 );
        expect( result.nodes[ 0 ].y ).toBe( 220 );
        expect( result.nodes[ 0 ].title ).toBe( "Renamed" );
        expect( result.nodes[ 0 ].colorFill ).toBe( "#112233" );
        expect( result.beforeSelection.nodes.has( 12 ) ).toBe( true );
        expect( result.afterSelection.nodes.has( 12 ) ).toBe( true );
    } );
} );
