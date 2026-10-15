// src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx
// Verifies manual force simulation progress reporting from the toolbar menu.

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SimMenu } from "./SimMenu";
import { DEFAULT_SIM_PARAMS } from "../../../../physics/defaults";
import { centerCameraOfSelection } from "../../../../state/selectionCamera";

const { startForcesRun, useAppStore, state, setState } = vi.hoisted( () => {
    const state = {
        nodes: [ { id: 1, title: "First", x: 0, y: 0 }, { id: 2, title: "Second", x: 300, y: 0 } ],
        actions: [],
        conditions: [],
        edges: [],
        selection: new Set<number>( [ 1 ] ),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        panzoom: { x: 0, y: 0, zoom: 1 },
        viewBox: { w: 800, h: 600 },
        canvasFitZoom: 1,
        isCanvasLockedByUITDLLiveSync: false,
        getSimulationSelectedNodes: () => new Set<number>( [ 1 ] ),
        compactFragmentsToGrid: vi.fn(),
    };

    const setState = vi.fn( ( updater: unknown ) => {
        const nextState = typeof updater === "function"
            ? ( updater as ( value: typeof state ) => Partial<typeof state> )( state )
            : updater as Partial<typeof state>;
        Object.assign( state, nextState );
    } );
    state.compactFragmentsToGrid.mockImplementation( () => {
        state.nodes = state.nodes.map( node => node.id === 1 ? { ...node, x: 200, y: 100 } : node );
    } );

    const useAppStore = Object.assign(
        ( selector: ( value: typeof state ) => unknown ) => selector( state ),
        { getState: () => state, setState }
    );
    return {
        startForcesRun: vi.fn( ( options: unknown ) => {
            void options;
            return vi.fn();
        } ),
        useAppStore,
        state,
        setState,
    };
} );

vi.mock( "../../../../state/store", () => ( { useAppStore } ) );
vi.mock( "../../../../physics/runForces", () => ( { startForcesRun } ) );

describe( "SimMenu", () => {
    beforeEach( () => {
        state.selection = new Set( [ 1 ] );
        state.selectionActions = new Set();
        state.selectionConds = new Set();
        state.nodes = [ { id: 1, title: "First", x: 0, y: 0 }, { id: 2, title: "Second", x: 300, y: 0 } ];
        state.panzoom = { x: 0, y: 0, zoom: 1 };
        state.compactFragmentsToGrid.mockClear();
        setState.mockClear();
        startForcesRun.mockClear();
    } );

    it( "opens the running simulation dialog before starting the manual simulation", () => {
        const onProgressChange = vi.fn();
        const onSimulationFinish = vi.fn();
        const onStopRefChange = vi.fn();
        const onOpenDialog = vi.fn();
        const onStopRequest = vi.fn();
        const onRequestStartAfterProgressVisible = vi.fn();

        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ onOpenDialog }
                onRequestStartAfterProgressVisible={ onRequestStartAfterProgressVisible }
                onStopRefChange={ onStopRefChange }
                onProgressChange={ onProgressChange }
                onSimulationFinish={ onSimulationFinish }
                onStopRequest={ onStopRequest }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Arrange selection" } ) );

        expect( onOpenDialog ).not.toHaveBeenCalled();
        expect( onStopRequest ).toHaveBeenCalledTimes( 1 );
        expect( onProgressChange ).toHaveBeenCalledWith( expect.objectContaining( {
            iterations: 0,
            totalIterations: DEFAULT_SIM_PARAMS.iterations,
        } ) );
        expect( onRequestStartAfterProgressVisible ).toHaveBeenCalledWith( expect.any( Function ) );
        expect( startForcesRun ).not.toHaveBeenCalled();

        const startAfterDialogVisible = onRequestStartAfterProgressVisible.mock.calls[ 0 ][ 0 ] as () => void;
        startAfterDialogVisible();
        expect( startForcesRun ).toHaveBeenCalledWith( expect.objectContaining( {
            onProgress: onProgressChange,
            onFinish: expect.any( Function ),
            physics: expect.objectContaining( {
                actionConditionEquilibriumDist: DEFAULT_SIM_PARAMS.actionConditionEquilibriumDist,
                actionConditionSpringK: DEFAULT_SIM_PARAMS.actionConditionSpringK,
                uiCoulombRepulsionFactor: DEFAULT_SIM_PARAMS.uiCoulombRepulsionFactor,
            } ),
        } ) );
        expect( onStopRefChange ).toHaveBeenCalledWith( expect.any( Function ) );

        const runOptions = startForcesRun.mock.calls[ 0 ][ 0 ] as { onFinish: () => void };
        runOptions.onFinish();
        expect( onSimulationFinish ).toHaveBeenCalledTimes( 1 );
    } );

    it( "compacts fragments to a grid without starting force simulation", () => {
        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ vi.fn() }
                onRequestStartAfterProgressVisible={ vi.fn() }
                onStopRefChange={ vi.fn() }
                onProgressChange={ vi.fn() }
                onSimulationFinish={ vi.fn() }
                onStopRequest={ vi.fn() }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Compact fragments to grid" } ) );

        expect( state.compactFragmentsToGrid ).toHaveBeenCalledTimes( 1 );
        expect( startForcesRun ).not.toHaveBeenCalled();
    } );

    it( "centers the previous selection after compacting fragments", () => {
        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ vi.fn() }
                onRequestStartAfterProgressVisible={ vi.fn() }
                onStopRefChange={ vi.fn() }
                onProgressChange={ vi.fn() }
                onSimulationFinish={ vi.fn() }
                onStopRequest={ vi.fn() }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Compact fragments to grid" } ) );

        const expectedCamera = centerCameraOfSelection( state, {
            nodes: new Set( [ 1 ] ),
            actions: new Set(),
            conditions: new Set(),
        } );
        expect( expectedCamera ).not.toBeNull();
        expect( state.panzoom ).toEqual( expect.objectContaining( expectedCamera! ) );
    } );

    it( "keeps the camera when no selection existed before compacting", () => {
        state.selection = new Set();
        const initialPanzoom = { ...state.panzoom };

        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ vi.fn() }
                onRequestStartAfterProgressVisible={ vi.fn() }
                onStopRefChange={ vi.fn() }
                onProgressChange={ vi.fn() }
                onSimulationFinish={ vi.fn() }
                onStopRequest={ vi.fn() }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Compact fragments to grid" } ) );

        expect( state.panzoom ).toEqual( initialPanzoom );
    } );
} );
