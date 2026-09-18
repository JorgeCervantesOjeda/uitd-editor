// src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx
// Verifies manual force simulation progress reporting from the toolbar menu.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimMenu } from "./SimMenu";
import { DEFAULT_SIM_PARAMS } from "../../../../physics/defaults";

const { startForcesRun, useAppStore } = vi.hoisted( () => {
    const state = {
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        getSimulationSelectedNodes: () => new Set<number>( [ 1 ] ),
    };

    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    return {
        startForcesRun: vi.fn( ( options: unknown ) => {
            void options;
            return vi.fn();
        } ),
        useAppStore,
    };
} );

vi.mock( "../../../../state/store", () => ( { useAppStore } ) );
vi.mock( "../../../../physics/runForces", () => ( { startForcesRun } ) );

describe( "SimMenu", () => {
    it( "reports progress while running a manual simulation", () => {
        const onProgressChange = vi.fn();
        const onSimulationFinish = vi.fn();
        const onStopRefChange = vi.fn();

        render(
            <SimMenu
                params={ DEFAULT_SIM_PARAMS }
                onOpenDialog={ vi.fn() }
                onStopRefChange={ onStopRefChange }
                onProgressChange={ onProgressChange }
                onSimulationFinish={ onSimulationFinish }
                onStopRequest={ vi.fn() }
            />
        );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Arrange selection" } ) );

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
} );
