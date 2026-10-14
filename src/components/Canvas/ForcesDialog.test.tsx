// Verifies that force arrangement starts only after the settings dialog is visible.

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import { ForcesDialog } from "./ForcesDialog";

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function advanceFrame() {
    const pending = [ ...frames.values() ];
    frames.clear();
    act( () => pending.forEach( callback => callback( 0 ) ) );
}

describe( "ForcesDialog visibility callback", () => {
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
            <ForcesDialog
                open
                initial={ DEFAULT_SIM_PARAMS }
                onSave={ vi.fn() }
                onClose={ vi.fn() }
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
