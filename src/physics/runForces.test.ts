import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    state,
    useAppStore,
    buildSimulatorFromStore,
    applyPositionsToStore,
    setRunSequence,
    resetState,
} = vi.hoisted( () => {
    const state = {
        nodes: [ { id: 1, x: 0, y: 0, title: "UI 1" } ],
        actions: [] as Array<unknown>,
        conditions: [] as Array<unknown>,
        selection: new Set<number>( [ 1 ] ),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        getSimulationSelectedNodes: () => new Set<number>( [ 1 ] ),
        pushDelta: vi.fn(),
    };

    let runSequence: number[] = [];

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

    const buildSimulatorFromStore = vi.fn( () => ( {
        run: vi.fn( () => ( { maxDisp: runSequence.shift() ?? 0 } ) ),
        getPositions: vi.fn( () => ( {
            "N.1": { x: state.nodes[ 0 ].x + 10, y: state.nodes[ 0 ].y },
        } ) ),
    } ) );

    const applyPositionsToStore = vi.fn( ( pos, set, get ) => {
        const current = get();
        const nextNodes = current.nodes.map( ( node: { id: number; x: number; y: number; title: string } ) => {
            const next = pos[ `N.${node.id}` ];
            return next ? { ...node, ...next } : node;
        } );
        set( { nodes: nextNodes } );
    } );

    const setRunSequence = ( values: number[] ) => {
        runSequence = [ ...values ];
    };

    const resetState = () => {
        state.nodes = [ { id: 1, x: 0, y: 0, title: "UI 1" } ];
        state.actions = [];
        state.conditions = [];
        state.selection = new Set<number>( [ 1 ] );
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        state.pushDelta.mockReset();
        buildSimulatorFromStore.mockClear();
        applyPositionsToStore.mockClear();
        runSequence = [];
    };

    return {
        state,
        useAppStore,
        buildSimulatorFromStore,
        applyPositionsToStore,
        setRunSequence,
        resetState,
    };
} );

vi.mock( "../state/store", () => ( { useAppStore } ) );
vi.mock( "./adapter", () => ( { buildSimulatorFromStore, applyPositionsToStore } ) );

import { startForcesRun } from "./runForces";

describe( "startForcesRun", () => {
    beforeEach( () => {
        resetState();
        vi.useFakeTimers();
        vi.stubGlobal(
            "requestAnimationFrame",
            ( cb: FrameRequestCallback ) => setTimeout( () => cb( 0 ), 0 ) as unknown as number
        );
        vi.stubGlobal(
            "cancelAnimationFrame",
            ( id: number ) => clearTimeout( id as unknown as ReturnType<typeof setTimeout> )
        );
    } );

    afterEach( () => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    } );

    it( "keeps the normal simulation path bounded by iterations", async () => {
        setRunSequence( [ 0.4, 0.3, 0.2 ] );
        const onFinish = vi.fn();

        startForcesRun( {
            iterations: 2,
            stepsPerFrame: 1,
            stopWhenConverged: false,
            convergenceThreshold: 1,
            stableFramesRequired: 1,
            onFinish,
        } );

        await vi.runAllTimersAsync();

        expect( onFinish ).toHaveBeenCalledTimes( 1 );
        expect( onFinish ).toHaveBeenCalledWith( "max_iterations" );
        expect( applyPositionsToStore ).toHaveBeenCalledTimes( 2 );
        expect( state.pushDelta ).toHaveBeenCalledTimes( 1 );
    } );

    it( "lets the post-import path stop by convergence without an iteration cap", async () => {
        setRunSequence( [ 19, 10 ] );
        const onFinish = vi.fn();
        const onProgress = vi.fn();

        startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: 1,
            stopWhenConverged: true,
            convergenceThreshold: 20,
            stableFramesRequired: 2,
            onFinish,
            onProgress,
        } );

        await vi.runAllTimersAsync();

        expect( onFinish ).toHaveBeenCalledTimes( 1 );
        expect( onFinish ).toHaveBeenCalledWith( "converged" );
        expect( onProgress ).toHaveBeenCalledTimes( 2 );
        expect( applyPositionsToStore ).toHaveBeenCalledTimes( 2 );
    } );

    it( "can stop the post-import path by stagnation without affecting the normal mode", async () => {
        setRunSequence( [ 80, 79.8, 79.7 ] );
        const onFinish = vi.fn();

        startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: 1,
            stopWhenConverged: true,
            convergenceThreshold: 20,
            stableFramesRequired: 12,
            stopWhenStalled: true,
            stallFramesRequired: 3,
            stallImprovementThreshold: 0.5,
            onFinish,
        } );

        await vi.runAllTimersAsync();

        expect( onFinish ).toHaveBeenCalledTimes( 1 );
        expect( onFinish ).toHaveBeenCalledWith( "stalled" );
        expect( applyPositionsToStore.mock.calls.length ).toBeGreaterThanOrEqual( 3 );
    } );
} );
