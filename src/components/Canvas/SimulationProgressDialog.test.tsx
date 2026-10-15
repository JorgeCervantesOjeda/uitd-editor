// Verifies that the running simulation dialog reports visibility before work starts.

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import { SimulationProgressDialog } from "./SimulationProgressDialog";

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function advanceFrame() {
    const pending = [ ...frames.values() ];
    frames.clear();
    act( () => pending.forEach( callback => callback( 0 ) ) );
}

describe( "SimulationProgressDialog visibility callback", () => {
    beforeEach( () => {
        frames = new Map();
        nextFrameId = 0;
        vi.stubGlobal( "requestAnimationFrame", ( callback: FrameRequestCallback ) => {
            const id = ++nextFrameId;
            frames.set( id, callback );
            return id;
        } );
        vi.stubGlobal( "cancelAnimationFrame", ( id: number ) => frames.delete( id ) );
    } );

    afterEach( () => {
        vi.unstubAllGlobals();
    } );

    it( "notifies visibility only after two animation frames", () => {
        const onVisible = vi.fn();

        render(
            <SimulationProgressDialog
                open
                progress={ {
                    iterations: 0,
                    totalIterations: DEFAULT_SIM_PARAMS.iterations,
                    maxDisp: Number.POSITIVE_INFINITY,
                    convergenceThreshold: 20,
                    stableFrames: 0,
                    stableFramesRequired: 12,
                    stopWhenConverged: true,
                } }
                onStop={ vi.fn() }
                onVisible={ onVisible }
            />
        );

        expect( onVisible ).not.toHaveBeenCalled();
        advanceFrame();
        expect( onVisible ).not.toHaveBeenCalled();
        advanceFrame();
        expect( onVisible ).toHaveBeenCalledTimes( 1 );
    } );
} );
