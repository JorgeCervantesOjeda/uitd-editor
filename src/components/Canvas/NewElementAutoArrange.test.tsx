// src/components/Canvas/NewElementAutoArrange.test.tsx
// Exercises creation and real physics with controlled animation frames.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import { SIM_PARAMS_STORAGE_KEY } from "../../physics/simParamsStorage";
import { NewElementAutoArrange } from "./NewElementAutoArrange";

const initial = useAppStore.getState();
let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function advanceFrame() {
    const pending = [ ...frames.values() ];
    frames.clear();
    act( () => pending.forEach( callback => callback( 0 ) ) );
}

function finishArrangement() {
    for ( let countOfFrames = 0; frames.size > 0 && countOfFrames < 100; countOfFrames++ ) advanceFrame();
    expect( frames.size ).toBe( 0 );
}

describe( "automatic arrangement after creation", () => {
    beforeEach( () => {
        frames = new Map();
        nextFrameId = 0;
        vi.stubGlobal( "requestAnimationFrame", ( callback: FrameRequestCallback ) => {
            const id = ++nextFrameId;
            frames.set( id, callback );
            return id;
        } );
        vi.stubGlobal( "cancelAnimationFrame", ( id: number ) => frames.delete( id ) );
        vi.spyOn( Math, "random" ).mockReturnValue( 0.5 );
        localStorage.setItem( SIM_PARAMS_STORAGE_KEY, JSON.stringify( {
            ...DEFAULT_SIM_PARAMS, iterations: 20, stepsPerFrame: 2, fastForward: 10,
        } ) );
        useAppStore.setState( {
            ...initial,
            nodes: [ { id: 1, title: "Existing", x: 0, y: 0 } ],
            actions: [ { id: 1, originNodeId: 1, title: "clicks X", verb: "clicks", complement: "X", x: 300, y: 100 } ],
            conditions: [ { id: 2, originActionId: 1, title: "Ready", x: 500, y: 100 } ],
            edges: [], nextId: 3, nextActionId: 2,
            selection: new Set( [ 1 ] ), selectionActions: new Set( [ 1 ] ), selectionConds: new Set( [ 2 ] ),
        }, true );
    } );
    afterEach( () => {
        vi.unstubAllGlobals();
        useAppStore.setState( initial, true );
    } );

    it.each( [ "node", "action", "condition" ] as const )( "arranges only the new %s after showing progress", kind => {
        const old = useAppStore.getState();
        render( <NewElementAutoArrange /> );
        act( () => {
            if ( kind === "node" ) old.createNodeAt( 40, 40 );
            if ( kind === "action" ) old.addActionForNode( 1 );
            if ( kind === "condition" ) old.handleCreateCondition( 1 );
        } );
        const created = useAppStore.getState();
        expect( screen.getByRole( "dialog", { name: "Arranging selection…" } ) ).toBeTruthy();
        advanceFrame();
        expect( useAppStore.getState().nodes ).toEqual( created.nodes );
        expect( useAppStore.getState().actions ).toEqual( created.actions );
        expect( useAppStore.getState().conditions ).toEqual( created.conditions );
        finishArrangement();
        const after = useAppStore.getState();
        expect( after.nodes.filter( n => n.id === 1 ) ).toEqual( old.nodes );
        expect( after.actions.filter( a => a.id === 1 ) ).toEqual( old.actions );
        expect( after.conditions.filter( c => c.id === 2 ) ).toEqual( old.conditions );
        const key = kind === "node" ? "nodes" : kind === "action" ? "actions" : "conditions";
        const id = kind === "action" ? 2 : 3;
        expect( after[ key ].find( item => item.id === id ) ).not.toEqual( created[ key ].find( item => item.id === id ) );
        expect( after.selection ).toEqual( new Set( kind === "node" ? [ id ] : [] ) );
        expect( after.selectionActions ).toEqual( new Set( kind === "action" ? [ id ] : [] ) );
        expect( after.selectionConds ).toEqual( new Set( kind === "condition" ? [ id ] : [] ) );
        expect( after.autoArrangeQueue ).toEqual( [] );
        expect( screen.queryByRole( "dialog" ) ).toBeNull();
        if ( kind === "condition" ) expect( after.pendingConnect?.mode ).toBe( "condition-to-target" );
    } );

    it( "can stop before movement begins", () => {
        render( <NewElementAutoArrange /> );
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        const before = useAppStore.getState().actions;
        fireEvent.click( screen.getByRole( "button", { name: "Stop arranging" } ) );
        finishArrangement();
        expect( useAppStore.getState().actions ).toEqual( before );
        expect( useAppStore.getState().autoArrangeQueue ).toEqual( [] );
    } );

    it( "arranges rapid additions one at a time with only the active new element selected", () => {
        render( <NewElementAutoArrange /> );
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        advanceFrame();
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        const before = useAppStore.getState().actions;
        advanceFrame();
        advanceFrame();
        const during = useAppStore.getState();
        expect( during.selectionActions ).toEqual( new Set( [ 2 ] ) );
        expect( during.actions.find( a => a.id === 2 ) ).not.toEqual( before.find( a => a.id === 2 ) );
        expect( during.actions.find( a => a.id === 3 ) ).toEqual( before.find( a => a.id === 3 ) );
        finishArrangement();
        expect( useAppStore.getState().selectionActions ).toEqual( new Set( [ 3 ] ) );
        expect( useAppStore.getState().actions.find( a => a.id === 3 ) ).not.toEqual( before.find( a => a.id === 3 ) );
    } );

    it( "skips a creation undone before the first physics frame", () => {
        render( <NewElementAutoArrange /> );
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        act( () => useAppStore.getState().undo() );
        const before = useAppStore.getState();
        finishArrangement();
        expect( useAppStore.getState().actions ).toEqual( before.actions );
        expect( useAppStore.getState().historyUndo ).toEqual( before.historyUndo );
        expect( useAppStore.getState().historyRedo ).toEqual( before.historyRedo );
        expect( screen.queryByRole( "dialog" ) ).toBeNull();
    } );

    it( "keeps later creations out of an active arrangement's undo entry", () => {
        render( <NewElementAutoArrange /> );
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        advanceFrame();
        advanceFrame();
        advanceFrame();
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        finishArrangement();
        act( () => useAppStore.getState().undo() );
        act( () => useAppStore.getState().undo() );
        expect( useAppStore.getState().actions.map( a => a.id ) ).toEqual( [ 1, 2, 3 ] );
        expect( useAppStore.getState().edges.map( e => e.to.id ) ).toEqual( [ 2, 3 ] );
    } );

    it( "does not arrange on mount or when undoing and redoing a completed creation", () => {
        render( <NewElementAutoArrange /> );
        expect( frames.size ).toBe( 0 );
        act( () => useAppStore.getState().addActionForNode( 1 ) );
        finishArrangement();
        act( () => useAppStore.getState().undo() );
        act( () => useAppStore.getState().undo() );
        expect( useAppStore.getState().actions ).toHaveLength( 1 );
        act( () => useAppStore.getState().redo() );
        act( () => useAppStore.getState().redo() );
        expect( useAppStore.getState().actions ).toHaveLength( 2 );
        expect( frames.size ).toBe( 0 );
    } );
} );
