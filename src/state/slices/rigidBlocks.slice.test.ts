// src/state/slices/rigidBlocks.slice.test.ts
// Verifies RigidBlock state mutations, validation notices, and history behavior.

import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store";

const initialState = useAppStore.getState();

function resetState() {
    useAppStore.setState( {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        rigidBlocks: [],
        nextRigidBlockId: 1,
        selection: new Set(),
        selectionActions: new Set(),
        selectionConds: new Set(),
        rigidBlockNotice: null,
        historyUndo: [],
        historyRedo: [],
        historyBytes: 0,
        editingSession: null,
    } );
}

describe( "RigidBlock state", () => {
    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "createsBlockFromNormalizedSelection", () => {
        resetState();
        useAppStore.setState( {
            nodes: [
                { id: 1, x: 0, y: 0, title: "Root", parentId: null },
                { id: 2, x: 80, y: 0, title: "Child", parentId: 1 },
            ],
            selection: new Set( [ 1 ] ),
        } );

        const result = useAppStore.getState().createRigidBlockFromSelection();

        expect( result.ok ).toBe( true );
        expect( useAppStore.getState().rigidBlocks ).toEqual( [ {
            id: 1,
            members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ],
        } ] );
        expect( useAppStore.getState().nextRigidBlockId ).toBe( 2 );
        expect( useAppStore.getState().rigidBlockNotice ).toMatchObject( { kind: "success" } );
    } );

    it( "doesNotMutateStateWhenSelectionCrossesFragments", () => {
        resetState();
        useAppStore.setState( {
            nodes: [
                { id: 1, x: 0, y: 0, title: "A", parentId: null },
                { id: 2, x: 200, y: 0, title: "B", parentId: null },
            ],
            selection: new Set( [ 1, 2 ] ),
        } );

        const result = useAppStore.getState().createRigidBlockFromSelection();

        expect( result ).toMatchObject( { ok: false, error: { code: "multiple-fragments" } } );
        expect( useAppStore.getState().rigidBlocks ).toEqual( [] );
        expect( useAppStore.getState().nextRigidBlockId ).toBe( 1 );
        expect( useAppStore.getState().rigidBlockNotice ).toMatchObject( { code: "multiple-fragments" } );
    } );

    it( "doesNotCreateOverlappingMembership", () => {
        resetState();
        useAppStore.setState( {
            nodes: [ { id: 1, x: 0, y: 0, title: "A", parentId: null } ],
            rigidBlocks: [ { id: 4, members: [ { kind: "node", id: 1 } ] } ],
            nextRigidBlockId: 5,
            selection: new Set( [ 1 ] ),
        } );

        const result = useAppStore.getState().createRigidBlockFromSelection();

        expect( result ).toMatchObject( { ok: false, error: { code: "member-overlap" } } );
        expect( useAppStore.getState().rigidBlocks ).toEqual( [ { id: 4, members: [ { kind: "node", id: 1 } ] } ] );
        expect( useAppStore.getState().nextRigidBlockId ).toBe( 5 );
    } );

    it( "undoesAndRedoesBlockCreation", () => {
        resetState();
        useAppStore.setState( {
            nodes: [ { id: 1, x: 0, y: 0, title: "A", parentId: null } ],
            selection: new Set( [ 1 ] ),
        } );

        useAppStore.getState().createRigidBlockFromSelection();
        useAppStore.getState().undo();
        expect( useAppStore.getState().rigidBlocks ).toEqual( [] );
        expect( useAppStore.getState().nextRigidBlockId ).toBe( 1 );

        useAppStore.getState().redo();
        expect( useAppStore.getState().rigidBlocks ).toEqual( [ {
            id: 1,
            members: [ { kind: "node", id: 1 } ],
        } ] );
        expect( useAppStore.getState().nextRigidBlockId ).toBe( 2 );
    } );

    it( "destroysAllBlocksIntersectingAWholeHierarchySelection", () => {
        resetState();
        useAppStore.setState( {
            nodes: [
                { id: 1, x: 0, y: 0, title: "Root", parentId: null },
                { id: 2, x: 80, y: 0, title: "Child", parentId: 1 },
            ],
            rigidBlocks: [
                { id: 4, members: [ { kind: "node", id: 1 } ] },
                { id: 5, members: [ { kind: "node", id: 2 } ] },
            ],
            selection: new Set( [ 1 ] ),
        } );

        expect( useAppStore.getState().getRigidBlockAvailability().canRemove ).toBe( true );
        expect( useAppStore.getState().destroyRigidBlocksFromSelection() ).toBe( true );
        expect( useAppStore.getState().rigidBlocks ).toEqual( [] );
        expect( useAppStore.getState().rigidBlockNotice ).toMatchObject( { message: "2 rigid blocks destroyed." } );
    } );
} );
