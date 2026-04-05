import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    state,
    useAppStore,
    importUITDL,
    startForcesRun,
    setNextFinishReason,
    resetMocks,
} = vi.hoisted( () => {
    const state = {
        nodes: [] as Array<{ id: number; x: number; y: number; title: string }>,
        actions: [] as Array<{ id: number; originNodeId: number; x: number; y: number; title: string; verb: string; complement: string }>,
        conditions: [] as Array<{ id: number; originActionId: number; x: number; y: number; title: string }>,
        edges: [] as Array<unknown>,
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        panzoom: { x: 0, y: 0, zoom: 1 },
        viewBox: { w: 800, h: 600 },
        selection: new Set<number>(),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        focusTarget: null,
        keyboardMarquee: null,
        marqueeSeed: null,
        drag: {
            active: false,
            anchor: { x: 0, y: 0 },
            startNodes: new Map(),
            startActions: new Map(),
            startConds: new Map(),
        },
        pendingConnect: null,
        dragHoverParent: null,
        dragGuides: { enabled: false },
        dragHistoryBefore: null,
        historyUndo: [] as Array<unknown>,
        historyRedo: [] as Array<unknown>,
        historyBytes: 0,
        editingSession: null,
        _clipboard: null,
        captureDelta: vi.fn( ( _keys: string[], fn: () => void ) => fn() ),
        commitEditingSession: vi.fn(),
        relayoutContainer: vi.fn(),
        relayoutAncestors: vi.fn(),
        clearSelection: vi.fn( () => {
            state.selection = new Set<number>();
            state.selectionActions = new Set<number>();
            state.selectionConds = new Set<number>();
        } ),
        resetProjectToBlank: vi.fn(),
        clearSavedProject: vi.fn(),
    };

    const useAppStore = ( ( selector?: ( value: typeof state ) => unknown ) =>
        selector ? selector( state ) : state ) as unknown as {
            ( selector?: ( value: typeof state ) => unknown ): unknown;
            getState: () => typeof state;
            setState: ( update: Partial<typeof state> | ( ( value: typeof state ) => Partial<typeof state> ) ) => void;
        };

    useAppStore.getState = () => state;
    useAppStore.setState = ( update ) => {
        const patch = typeof update === "function" ? update( state ) : update;
        Object.assign( state, patch );
    };

    const importUITDL = vi.fn( () => ( {
        nodes: [ { id: 1, x: 100, y: 120, title: "Pantalla 1" } ],
        actions: [
            { id: 10, originNodeId: 1, x: 140, y: 120, title: 'CLICK "Go"', verb: "CLICK", complement: "Go" },
        ],
        conditions: [
            { id: 20, originActionId: 10, x: 180, y: 120, title: "ok" },
        ],
        edges: [
            { id: 100, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 101, from: { kind: "action", id: 10 }, to: { kind: "condition", id: 20 }, style: "dashed2" },
        ],
        nextId: 2,
        nextActionId: 11,
        nextEdgeId: 102,
        panzoom: state.panzoom,
        viewBox: state.viewBox,
    } ) );

    let nextFinishReason: "converged" | "cancelled" | "max_iterations" | "stalled" | null = null;

    const startForcesRun = vi.fn( ( opts: { onFinish?: ( reason: "converged" | "cancelled" | "max_iterations" | "stalled" ) => void } ) => {
        if ( nextFinishReason ) {
            const reason = nextFinishReason;
            nextFinishReason = null;
            Promise.resolve().then( () => {
                opts.onFinish?.( reason );
            } );
        }
        const stop = vi.fn( () => {
            opts.onFinish?.( "cancelled" );
        } );
        return stop;
    } );

    const setNextFinishReason = ( reason: "converged" | "cancelled" | "max_iterations" | "stalled" | null ) => {
        nextFinishReason = reason;
    };

    const resetMocks = () => {
        state.nodes = [];
        state.actions = [];
        state.conditions = [];
        state.edges = [];
        state.nextId = 1;
        state.nextActionId = 1;
        state.nextEdgeId = 1;
        state.panzoom = { x: 0, y: 0, zoom: 1 };
        state.viewBox = { w: 800, h: 600 };
        state.selection = new Set<number>();
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        state.captureDelta.mockClear();
        state.commitEditingSession.mockClear();
        state.relayoutContainer.mockClear();
        state.relayoutAncestors.mockClear();
        state.clearSelection.mockClear();
        state.resetProjectToBlank.mockClear();
        state.clearSavedProject.mockClear();
        importUITDL.mockClear();
        startForcesRun.mockClear();
        nextFinishReason = null;
        localStorage.clear();
    };

    return {
        state,
        useAppStore,
        importUITDL,
        startForcesRun,
        setNextFinishReason,
        resetMocks,
    };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );
vi.mock( "../../import/uitdl", () => ( { importUITDL } ) );
vi.mock( "../../physics/runForces", () => ( { startForcesRun } ) );
vi.mock( "../../layout/measurement", () => ( {
    getNodeSizeCached: vi.fn( () => ( { w: 120, h: 80 } ) ),
    measureActionOval: vi.fn( () => ( { w: 100, h: 50 } ) ),
    measureConditionOval: vi.fn( () => ( { w: 100, h: 50 } ) ),
} ) );

import { FileToolbar } from "./FileToolbar";

describe( "FileToolbar UITDL import", () => {
    beforeEach( () => {
        resetMocks();
        vi.spyOn( window, "alert" ).mockImplementation( () => {} );
    } );

    it( "starts the post-import convergence flow automatically", async () => {
        const confirmSpy = vi.spyOn( window, "confirm" );

        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( importUITDL ).toHaveBeenCalledTimes( 1 );
            expect( startForcesRun ).toHaveBeenCalledTimes( 1 );
        } );

        expect( startForcesRun ).toHaveBeenCalledWith(
            expect.objectContaining( {
                iterations: Number.POSITIVE_INFINITY,
                stopWhenConverged: true,
                convergenceThreshold: 20,
                stableFramesRequired: 12,
                stopWhenStalled: true,
                stallFramesRequired: 180,
                stallImprovementThreshold: 0.5,
            } )
        );
        expect( confirmSpy ).not.toHaveBeenCalled();
        expect( screen.getByText( "Progreso de simulación" ) ).toBeTruthy();
        expect( screen.getByRole( "button", { name: "Interrumpir" } ) ).toBeTruthy();

        const runOptions = startForcesRun.mock.calls[ 0 ][ 0 ] as {
            onFinish?: ( reason: "cancelled" ) => void;
        };
        runOptions.onFinish?.( "cancelled" );

        await waitFor( () => {
            expect( state.clearSelection ).toHaveBeenCalledTimes( 1 );
        } );
    } );

    it( "auto-starts the simulation after UITDL import without asking the user", async () => {
        const confirmSpy = vi.spyOn( window, "confirm" );

        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( importUITDL ).toHaveBeenCalledTimes( 1 );
            expect( startForcesRun ).toHaveBeenCalledTimes( 1 );
        } );

        expect( confirmSpy ).not.toHaveBeenCalled();
        expect( screen.getByText( "Progreso de simulación" ) ).toBeTruthy();
    } );

    it( "selects all imported nodes, actions and conditions before starting the post-import run", async () => {
        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( startForcesRun ).toHaveBeenCalledTimes( 1 );
        } );

        expect( Array.from( state.selection ) ).toEqual( [ 1 ] );
        expect( Array.from( state.selectionActions ) ).toEqual( [ 10 ] );
        expect( Array.from( state.selectionConds ) ).toEqual( [ 20 ] );
    } );

    it( "shows an alert if the import simulation reports max_iterations", async () => {
        const alertSpy = vi.spyOn( window, "alert" ).mockImplementation( () => {} );
        setNextFinishReason( "max_iterations" );

        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( alertSpy ).toHaveBeenCalledWith( "La simulación se detuvo sin converger completamente." );
        } );
        expect( state.clearSelection ).toHaveBeenCalledTimes( 1 );
        expect( screen.queryByText( "Progreso de simulación" ) ).toBeNull();
    } );

    it( "shows an alert if the import simulation stops by stagnation", async () => {
        const alertSpy = vi.spyOn( window, "alert" ).mockImplementation( () => {} );
        setNextFinishReason( "stalled" );

        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( alertSpy ).toHaveBeenCalledWith( "La simulación se detuvo por estancamiento." );
        } );
        expect( state.clearSelection ).toHaveBeenCalledTimes( 1 );
        expect( screen.queryByText( "Progreso de simulación" ) ).toBeNull();
    } );

    it( "cancels an active import simulation if the toolbar unmounts mid-run", async () => {
        const { container, unmount } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[accept=".uitd,.txt,text/plain"]' ) as HTMLInputElement | null;
        expect( input ).not.toBeNull();

        const file = new File( [ "UITDL content" ], "diagram.uitd", { type: "text/plain" } );
        Object.defineProperty( input, "files", {
            configurable: true,
            value: [ file ],
        } );

        fireEvent.change( input! );

        await waitFor( () => {
            expect( startForcesRun ).toHaveBeenCalledTimes( 1 );
        } );

        const stop = startForcesRun.mock.results[ 0 ]?.value as ReturnType<typeof vi.fn>;
        expect( stop ).toBeTruthy();

        unmount();

        expect( stop ).toHaveBeenCalledTimes( 1 );
        expect( state.clearSelection ).toHaveBeenCalledTimes( 1 );
    } );
} );
