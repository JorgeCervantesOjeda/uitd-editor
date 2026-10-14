// src/state/selection.test.ts
// Verifies selecting all diagram elements through the application state.

import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";

const initialState = useAppStore.getState();

describe( "selectAll", () => {
    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "selects every node, action, and condition and focuses the first element", () => {
        useAppStore.setState( {
            nodes: [
                { id: 1, title: "Node 1", x: 300, y: 300 },
                { id: 2, title: "Node 2", x: 100, y: 100 },
            ],
            actions: [ { id: 1, originNodeId: 1, title: "clicks Next", verb: "clicks", complement: "Next", x: 200, y: 100 } ],
            conditions: [ { id: 1, originActionId: 1, title: "Ready", x: 400, y: 100 } ],
            selection: new Set( [ 1 ] ),
            selectionActions: new Set(),
            selectionConds: new Set(),
            focusTarget: null,
            keyboardMarquee: null,
            marqueeSeed: null,
        } );

        useAppStore.getState().selectAll();

        expect( useAppStore.getState().selection ).toEqual( new Set( [ 1, 2 ] ) );
        expect( useAppStore.getState().selectionActions ).toEqual( new Set( [ 1 ] ) );
        expect( useAppStore.getState().selectionConds ).toEqual( new Set( [ 1 ] ) );
        expect( useAppStore.getState().focusTarget ).toEqual( { kind: "node", id: 2 } );
        expect( useAppStore.getState().historyUndo ).toHaveLength( 0 );
    } );
} );
