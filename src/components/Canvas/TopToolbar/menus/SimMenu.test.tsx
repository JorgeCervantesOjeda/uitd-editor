// src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx
// Verifies manual force simulation progress reporting from the toolbar menu.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimMenu } from "./SimMenu";
import { DEFAULT_SIM_PARAMS } from "../../../../physics/defaults";

const { startForcesRun, useAppStore, state } = vi.hoisted( () => {
    const state = {
        nodes: [ { id: 1, title: "First", x: 0, y: 0 }, { id: 2, title: "Second", x: 300, y: 0 } ],
        actions: [],
        conditions: [],
        edges: [],
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        isCanvasLockedByUITDLLiveSync: false,
        getSimulationSelectedNodes: () => new Set<number>( [ 1 ] ),
        compactFragmentsToGrid: vi.fn(),
    };

    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    useAppStore.getState = () => state;
    return {
        startForcesRun: vi.fn( ( options: unknown ) => {
            void options;
            return vi.fn();
        } ),
        useAppStore,
        state,
    };
} );

vi.mock( "../../../../state/store", () => ( { useAppStore } ) );
vi.mock( "../../../../physics/runForces", () => ( { startForcesRun } ) );

describe( "SimMenu", () => {
    it( "opens the arrangement dialog before starting the manual simulation", () => {
        const onProgressChange = vi.fn();
        const onSimulationFinish = vi.fn();
        const onStopRefChange = vi.fn();
        const onOpenDialog = vi.fn();

        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ onOpenDialog }
                onStopRefChange={ onStopRefChange }
                onProgressChange={ onProgressChange }
                onSimulationFinish={ onSimulationFinish }
                onStopRequest={ vi.fn() }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Arrange selection" } ) );

        expect( onOpenDialog ).toHaveBeenCalledWith( expect.any( Function ) );
        expect( onProgressChange ).not.toHaveBeenCalled();
        expect( startForcesRun ).not.toHaveBeenCalled();

        const onDialogVisible = onOpenDialog.mock.calls[ 0 ][ 0 ] as () => void;
        onDialogVisible();

        expect( onProgressChange ).toHaveBeenCalledWith( expect.objectContaining( {
            iterations: 0,
            totalIterations: DEFAULT_SIM_PARAMS.iterations,
        } ) );
        expect( startForcesRun ).toHaveBeenCalledWith( expect.objectContaining( {
            onProgress: onProgressChange,
            onFinish: expect.any( Function ),
        } ) );
        expect( onStopRefChange ).toHaveBeenCalledWith( expect.any( Function ) );

        const runOptions = startForcesRun.mock.calls[ 0 ][ 0 ] as { onFinish: () => void };
        runOptions.onFinish();
        expect( onSimulationFinish ).toHaveBeenCalledTimes( 1 );
    } );

    it( "compacts fragments to a grid without starting force simulation", () => {
        startForcesRun.mockClear();
        state.compactFragmentsToGrid.mockClear();

        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ vi.fn() }
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
} );
