// src/state/slices/clipboard.slice.test.ts
// Verifies complete/partial RigidBlock clipboard behavior and deletion pruning.

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
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        nextRigidBlockId: 1,
        selection: new Set(),
        selectionActions: new Set(),
        selectionConds: new Set(),
        rigidBlockNotice: null,
        _clipboard: null,
        historyUndo: [],
        historyRedo: [],
        historyBytes: 0,
        editingSession: null,
    } );
}

function setTwoNodeBlock() {
    useAppStore.setState( {
        nodes: [
            { id: 1, x: 0, y: 0, title: "A", parentId: null },
            { id: 2, x: 80, y: 0, title: "B", parentId: null },
        ],
        nextId: 3,
        rigidBlocks: [ { id: 1, members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ] } ],
        nextRigidBlockId: 2,
    } );
}

describe( "RigidBlock clipboard and deletion reconciliation", () => {
    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "copiesCompleteRigidBlockMetadata", () => {
        resetState();
        setTwoNodeBlock();
        useAppStore.setState( { selection: new Set( [ 1, 2 ] ) } );

        useAppStore.getState().copySelectionToClipboard();

        expect( useAppStore.getState()._clipboard?.rigidBlocks ).toEqual( [
            { id: 1, members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ] },
        ] );
        expect( useAppStore.getState()._clipboard?.partialRigidBlockIds ).toEqual( [] );
    } );

    it( "pastesCompleteRigidBlockWithRemappedMembers", () => {
        resetState();
        setTwoNodeBlock();
        useAppStore.setState( { selection: new Set( [ 1, 2 ] ) } );
        useAppStore.getState().copySelectionToClipboard();

        useAppStore.getState().pasteFromClipboardAt( 200, 0 );

        expect( useAppStore.getState().rigidBlocks ).toEqual( [
            { id: 1, members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ] },
            { id: 2, members: [ { kind: "node", id: 3 }, { kind: "node", id: 4 } ] },
        ] );
    } );

    it( "doesNotPastePartialRigidBlockMembership", () => {
        resetState();
        setTwoNodeBlock();
        useAppStore.setState( { selection: new Set( [ 1 ] ) } );
        useAppStore.getState().copySelectionToClipboard();

        useAppStore.getState().pasteFromClipboardAt( 200, 0 );

        expect( useAppStore.getState().rigidBlocks ).toEqual( [
            { id: 1, members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ] },
        ] );
        expect( useAppStore.getState().rigidBlockNotice ).toMatchObject( { kind: "error", code: "partial-copy" } );
    } );

    it( "prunesDeletedMembersFromRigidBlocks", () => {
        resetState();
        setTwoNodeBlock();
        useAppStore.setState( { selection: new Set( [ 1 ] ) } );

        useAppStore.getState().deleteSelected();

        expect( useAppStore.getState().rigidBlocks ).toEqual( [
            { id: 1, members: [ { kind: "node", id: 2 } ] },
        ] );
    } );

    it( "removesEmptyRigidBlocksAfterDeletion", () => {
        resetState();
        setTwoNodeBlock();
        useAppStore.setState( { selection: new Set( [ 1, 2 ] ) } );

        useAppStore.getState().deleteSelected();

        expect( useAppStore.getState().rigidBlocks ).toEqual( [] );
    } );
} );
