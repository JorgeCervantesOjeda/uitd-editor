// src/physics/runForces.test.ts
// Verifies force simulation completion, cancellation, and progress behavior.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    state,
    useAppStore,
    buildSimulatorFromStore,
    applyPositionsToStore,
    setRunSequence,
    setPositionSequence,
    resetState,
} = vi.hoisted( () => {
    const state = {
        nodes: [ { id: 1, x: 0, y: 0, title: "UI 1" } ],
        actions: [] as Array<unknown>,
        conditions: [] as Array<unknown>,
        edges: [] as Array<unknown>,
        rigidBlocks: [] as Array<{ id: number; members: Array<{ kind: string; id: number }> }>,
        selection: new Set<number>( [ 1 ] ),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        getSimulationSelectedNodes: () => new Set<number>( [ 1 ] ),
        pushDelta: vi.fn(),
    };

    let runSequence: number[] = [];
    let positionSequence: Array<Record<string, { x: number; y: number }>> = [];

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
        getPositions: vi.fn( () => positionSequence.shift() ?? ( {
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

    const setPositionSequence = ( values: Array<Record<string, { x: number; y: number }>> ) => {
        positionSequence = [ ...values ];
    };

    const resetState = () => {
        state.nodes = [ { id: 1, x: 0, y: 0, title: "UI 1" } ];
        state.actions = [];
        state.conditions = [];
        state.edges = [];
        state.rigidBlocks = [];
        state.selection = new Set<number>( [ 1 ] );
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        state.getSimulationSelectedNodes = () => new Set<number>( [ 1 ] );
        state.pushDelta.mockReset();
        buildSimulatorFromStore.mockClear();
        applyPositionsToStore.mockClear();
        runSequence = [];
        positionSequence = [];
    };

    return {
        state,
        useAppStore,
        buildSimulatorFromStore,
        applyPositionsToStore,
        setRunSequence,
        setPositionSequence,
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

    it( "builds one independent simulation per selected fragment with fixed local anchors", () => {
        state.nodes = [
            { id: 1, x: 0, y: 0, title: "Selected A" },
            { id: 2, x: 80, y: 0, title: "Fixed anchor A" },
            { id: 3, x: 500, y: 0, title: "Selected B" },
        ];
        state.edges = [ {
            from: { kind: "node", id: 1 },
            to: { kind: "node", id: 2 },
            style: "solid",
        } ];
        state.selection = new Set<number>( [ 1, 3 ] );
        state.getSimulationSelectedNodes = () => new Set<number>( [ 1, 3 ] );

        startForcesRun( { iterations: 0 } );

        expect( buildSimulatorFromStore ).toHaveBeenCalledTimes( 2 );
        const calls = ( buildSimulatorFromStore.mock.calls as unknown as Array<unknown[]> ).map( call => ( {
            movable: call[ 2 ] as Set<string>,
            included: call[ 3 ] as Set<string>,
        } ) );
        expect( calls ).toEqual( expect.arrayContaining( [
            { movable: new Set( [ "N.1" ] ), included: new Set( [ "N.1", "N.2" ] ) },
            { movable: new Set( [ "N.3" ] ), included: new Set( [ "N.3" ] ) },
        ] ) );
    } );

    it( "expandsMovabilityWhenAnyBlockMemberIsSelected", () => {
        state.nodes = [
            { id: 1, x: 0, y: 0, title: "Selected" },
            { id: 2, x: 80, y: 0, title: "Rigid partner" },
        ];
        state.rigidBlocks = [ {
            id: 7,
            members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ],
        } ];
        state.edges = [ {
            from: { kind: "node", id: 1 },
            to: { kind: "node", id: 2 },
            style: "solid",
        } ];
        state.selection = new Set<number>( [ 1 ] );
        state.getSimulationSelectedNodes = () => new Set<number>( [ 1 ] );

        startForcesRun( { iterations: 0 } );

        expect( buildSimulatorFromStore ).toHaveBeenCalledTimes( 1 );
        const firstBuildCall = ( buildSimulatorFromStore.mock.calls as unknown as Array<unknown[]> )[ 0 ];
        expect( firstBuildCall[ 2 ] ).toEqual( new Set( [ "N.1", "N.2" ] ) );
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

    it( "uses accumulated movement over a position window before declaring stability", async () => {
        setRunSequence( Array.from( { length: 9 }, () => 0 ) );
        setPositionSequence( [
            { "N.1": { x: 10, y: 0 } },
            { "N.1": { x: 14, y: 0 } },
            { "N.1": { x: 10, y: 0 } },
            { "N.1": { x: 11, y: 0 } },
            { "N.1": { x: 10, y: 0 } },
            { "N.1": { x: 11, y: 0 } },
            { "N.1": { x: 10, y: 0 } },
            { "N.1": { x: 11, y: 0 } },
            { "N.1": { x: 10, y: 0 } },
        ] );
        const onFinish = vi.fn();

        startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: 1,
            stopWhenConverged: true,
            stableFramesRequired: 2,
            stabilityWindowSize: 3,
            stabilityPathThreshold: 2,
            onFinish,
        } );

        await vi.runAllTimersAsync();

        expect( onFinish ).toHaveBeenCalledWith( "converged" );
        expect( applyPositionsToStore ).toHaveBeenCalledTimes( 6 );
    } );

    it( "finishes as cancelled when the selected items resolve to no movable simulation items", async () => {
        state.getSimulationSelectedNodes = () => new Set<number>();
        const onFinish = vi.fn();

        const stop = startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: 1,
            stopWhenConverged: true,
            convergenceThreshold: 20,
            stableFramesRequired: 2,
            onFinish,
        } );

        await Promise.resolve();
        stop();

        expect( onFinish ).toHaveBeenCalledTimes( 1 );
        expect( onFinish ).toHaveBeenCalledWith( "cancelled" );
        expect( buildSimulatorFromStore ).not.toHaveBeenCalled();
        expect( applyPositionsToStore ).not.toHaveBeenCalled();
    } );

    it( "keeps the current positions when an active arrangement is stopped", () => {
        const frames = new Map<number, FrameRequestCallback>();
        let nextFrameId = 0;
        vi.stubGlobal( "requestAnimationFrame", ( callback: FrameRequestCallback ) => {
            const id = ++nextFrameId;
            frames.set( id, callback );
            return id;
        } );
        vi.stubGlobal( "cancelAnimationFrame", ( id: number ) => frames.delete( id ) );
        setPositionSequence( [ { "N.1": { x: 25, y: 0 } } ] );
        const onFinish = vi.fn();

        const stop = startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: 1,
            onFinish,
        } );

        const firstFrame = frames.values().next().value as FrameRequestCallback;
        frames.clear();
        firstFrame( 0 );
        stop();

        expect( state.nodes[ 0 ] ).toMatchObject( { x: 25, y: 0 } );
        expect( onFinish ).toHaveBeenCalledWith( "cancelled" );
        expect( state.pushDelta ).toHaveBeenCalledTimes( 1 );
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

    it( "can leave history ownership to the caller when the simulation is part of a larger edit", async () => {
        setRunSequence( [ 0.4, 0.3 ] );

        startForcesRun( {
            iterations: 2,
            stepsPerFrame: 1,
            recordHistory: false,
            stopWhenConverged: false,
        } );

        await vi.runAllTimersAsync();

        expect( state.pushDelta ).not.toHaveBeenCalled();
    } );
} );
