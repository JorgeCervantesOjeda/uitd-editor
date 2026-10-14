// src/state/history.test.ts
// Verifies that source-aware history events identify UITDL Apply operations.

import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";

const initialState = useAppStore.getState();

describe( "source-aware history events", () => {
    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "marks an UITDL Apply entry and emits its undo and redo direction", () => {
        useAppStore.setState( {
            nodes: [ { id: 1, title: "Before", x: 0, y: 0 } ],
            actions: [],
            conditions: [],
            edges: [],
            historyUndo: [],
            historyRedo: [],
            historyBytes: 0,
            editingSession: null,
            historyEvent: null,
            historyEventId: 0,
        } );

        useAppStore.getState().beginEditingSession( [ "nodes" ], { source: "uitdl-apply" } );
        useAppStore.getState().captureDelta( [ "nodes" ], () => {
            useAppStore.setState( { nodes: [ { id: 1, title: "After", x: 100, y: 100 } ] } );
        } );
        useAppStore.getState().commitEditingSession();

        expect( useAppStore.getState().historyUndo[ 0 ]?.source ).toBe( "uitdl-apply" );

        useAppStore.getState().undo();
        expect( useAppStore.getState().nodes ).toEqual( [ { id: 1, title: "Before", x: 0, y: 0 } ] );
        expect( useAppStore.getState().historyEvent ).toEqual( {
            id: 1,
            direction: "undo",
            source: "uitdl-apply",
        } );

        useAppStore.getState().redo();
        expect( useAppStore.getState().nodes ).toEqual( [ { id: 1, title: "After", x: 100, y: 100 } ] );
        expect( useAppStore.getState().historyEvent ).toEqual( {
            id: 2,
            direction: "redo",
            source: "uitdl-apply",
        } );
    } );
} );
