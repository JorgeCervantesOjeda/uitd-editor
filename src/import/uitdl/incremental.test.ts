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

    it( "preserves node identity and position when replace all changes a UIID", () => {
        const beforeText = `UITD "Renumber" {
            UI 1 "Start" actions {}
            FRAGMENT "Only UI" {
                DRAW { 1 };
            }
        }`;
        const afterText = beforeText.replace( /1/g, "2" );
        const base = reconcileUITDLTextIncrementally( beforeText, baseState() );
        base.nodes[ 0 ] = {
            ...base.nodes[ 0 ],
            x: 300,
            y: 220,
        };

        const result = reconcileUITDLTextIncrementally( afterText, baseState( base ) );

        expect( result.nodes[ 0 ].id ).toBe( base.nodes[ 0 ].id );
        expect( result.nodes[ 0 ].displayId ).toBe( "2" );
        expect( result.nodes[ 0 ].x ).toBe( 300 );
        expect( result.nodes[ 0 ].y ).toBe( 220 );
        expect( result.beforeSelection.nodes ).toEqual( new Set( [ base.nodes[ 0 ].id ] ) );
        expect( result.afterSelection.nodes ).toEqual( new Set( [ base.nodes[ 0 ].id ] ) );
    } );

    it( "preserves connected action condition and edge identity when a UIID is replaced everywhere", () => {
        const beforeText = `UITD "Renumber connected" {
            UI 1 "Start" actions {
                clicks "Go";
            }
            FRAGMENT "Main" {
                DRAW { 1 };
                TRANSITION from 1 to 1 if user clicks "Go" AND "ready";
            }
        }`;
        const afterText = beforeText.replace( /1/g, "2" );
        const base = reconcileUITDLTextIncrementally( beforeText, baseState() );
        base.nodes[ 0 ] = { ...base.nodes[ 0 ], x: 300, y: 220 };
        base.actions[ 0 ] = { ...base.actions[ 0 ], x: 420, y: 260 };
        base.conditions[ 0 ] = { ...base.conditions[ 0 ], x: 540, y: 300 };
        const actionId = base.actions[ 0 ].id;
        const conditionId = base.conditions[ 0 ].id;
        const edgeIds = base.edges.map( edge => edge.id );

        const result = reconcileUITDLTextIncrementally( afterText, baseState( base ) );

        expect( result.nodes[ 0 ].id ).toBe( base.nodes[ 0 ].id );
        expect( result.actions[ 0 ].id ).toBe( actionId );
        expect( result.conditions[ 0 ].id ).toBe( conditionId );
        expect( result.edges.map( edge => edge.id ) ).toEqual( edgeIds );
        expect( result.actions[ 0 ].originNodeId ).toBe( base.nodes[ 0 ].id );
        expect( result.conditions[ 0 ].originActionId ).toBe( actionId );
        expect( result.actions[ 0 ].x ).toBe( 420 );
        expect( result.conditions[ 0 ].x ).toBe( 540 );
        expect( result.afterSelection.nodes ).toEqual( new Set( [ base.nodes[ 0 ].id ] ) );
        expect( result.afterSelection.actions.size ).toBe( 0 );
        expect( result.afterSelection.conditions.size ).toBe( 0 );
    } );

    it( "preserves a renumbered UI with incoming edges and colliding internal condition ids", () => {
        const afterText = `UITD "UITD Diagram" {
            UI 2 "Home" actions {
                clicks "Logout";
            }
            UI 5 "Error" actions {
                clicks "OK";
            }
            UI 6 "Node 6" actions {
                clicks "X";
            }
            UI 9 "Log in" actions {
                clicks "submit";
            }
            FRAGMENT "name" {
                DRAW {2, 5, 6, 9 };
                TRANSITION from 9 to 2 if user clicks "submit" AND "ok";
                TRANSITION from 9 to 5 if user clicks "submit" AND "not ok";
                TRANSITION from 2 to 9 if user clicks "Logout";
                TRANSITION from 5 to 9 if user clicks "OK";
                TRANSITION from 6 to 5 if user clicks "X";
            }
        }`;

        const base = baseState( {
            nodes: [
                { id: 18, displayId: "2", title: "Home", x: 383.945, y: 300.028, w: 78, h: 40, wrap: 22, parentId: null },
                { id: 5, displayId: "5", title: "Error", x: -260.313, y: 244.474, w: 87, h: 40, wrap: 22, parentId: null },
                { id: 6, displayId: "6", title: "Node 6", x: -619.005, y: 230.453, w: 96, h: 40, wrap: 22, parentId: null },
                { id: 19, displayId: "1", title: "Log in", x: 84.566, y: 171.471, w: 96, h: 40, wrap: 22, parentId: null },
            ],
            actions: [
                { id: 12, originNodeId: 19, x: 69.019, y: 370.562, w: 159, h: 44, verb: "clicks", complement: "submit", title: 'clicks "submit"', wrap: 22 },
                { id: 11, originNodeId: 18, x: 289.837, y: 134.757, w: 159, h: 44, verb: "clicks", complement: "Logout", title: 'clicks "Logout"', wrap: 22 },
                { id: 3, originNodeId: 5, x: -86.682, y: 121.34, w: 123, h: 44, verb: "clicks", complement: "OK", title: 'clicks "OK"', wrap: 22 },
                { id: 4, originNodeId: 6, x: -410.69, y: 237.361, w: 114, h: 44, verb: "clicks", complement: "X", title: 'clicks "X"', wrap: 22 },
            ],
            conditions: [
                { id: 19, originActionId: 12, title: "ok", x: 267.96, y: 417.524, w: 70, h: 42, wrap: 22 },
                { id: 20, originActionId: 12, title: "not ok", x: -113.947, y: 387.806, w: 94, h: 42, wrap: 22 },
            ],
            edges: [
                { id: 56, from: { kind: "node", id: 19 }, to: { kind: "action", id: 12 }, style: "solid" },
                { id: 57, from: { kind: "action", id: 12 }, to: { kind: "condition", id: 19 }, style: "dashed2" },
                { id: 58, from: { kind: "condition", id: 19 }, to: { kind: "node", id: 18 }, style: "dashed1" },
                { id: 59, from: { kind: "action", id: 12 }, to: { kind: "condition", id: 20 }, style: "dashed2" },
                { id: 60, from: { kind: "condition", id: 20 }, to: { kind: "node", id: 5 }, style: "dashed1" },
                { id: 54, from: { kind: "node", id: 18 }, to: { kind: "action", id: 11 }, style: "solid" },
                { id: 61, from: { kind: "action", id: 11 }, to: { kind: "node", id: 19 }, style: "dashed1" },
                { id: 10, from: { kind: "node", id: 5 }, to: { kind: "action", id: 3 }, style: "solid" },
                { id: 62, from: { kind: "action", id: 3 }, to: { kind: "node", id: 19 }, style: "dashed1" },
                { id: 13, from: { kind: "node", id: 6 }, to: { kind: "action", id: 4 }, style: "solid" },
                { id: 14, from: { kind: "action", id: 4 }, to: { kind: "node", id: 5 }, style: "dashed1" },
            ],
            fragmentTitles: {
                "action:11|action:12|action:3|action:4|condition:19|condition:20|node:18|node:19|node:5|node:6": "name",
            },
            nextId: 21,
            nextActionId: 13,
            nextEdgeId: 63,
        } );

        const result = reconcileUITDLTextIncrementally( afterText, base );

        expect( result.nodes.find( node => node.title === "Log in" ) ).toMatchObject( {
            id: 19,
            displayId: "9",
            x: 84.566,
            y: 171.471,
        } );
        expect( result.actions.find( action => action.title === 'clicks "submit"' ) ).toMatchObject( {
            id: 12,
            originNodeId: 19,
            x: 69.019,
            y: 370.562,
        } );
        expect( result.conditions.map( condition => condition.id ) ).toEqual( [ 19, 20 ] );
        expect( result.edges.map( edge => edge.id ) ).toEqual( [ 56, 57, 58, 59, 60, 54, 61, 10, 62, 13, 14 ] );
        expect( result.afterSelection.nodes ).toEqual( new Set( [ 19 ] ) );
        expect( result.afterSelection.actions.size ).toBe( 0 );
        expect( result.afterSelection.conditions.size ).toBe( 0 );
    } );

    it( "reports a change when only the fragment title changes", () => {
        const text = `UITD "Fragment rename" {
            UI 1 "Start" actions {}
            FRAGMENT "Renamed flow" {
                DRAW { 1 };
            }
        }`;
        const fragmentId = "node:12";

        const result = reconcileUITDLTextIncrementally( text, baseState( {
            nodes: [ {
                id: 12,
                displayId: "1",
                title: "Start",
                x: 300,
                y: 220,
                w: 100,
                h: 70,
                parentId: null,
            } ],
            fragmentTitles: {
                [ fragmentId ]: "Original flow",
            },
            nextId: 13,
        } ) );

        expect( result.changedCount ).toBeGreaterThan( 0 );
        expect( result.fragmentTitles[ fragmentId ] ).toBe( "Renamed flow" );
        expect( result.nodes[ 0 ].id ).toBe( 12 );
    } );
} );
