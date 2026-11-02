// src/components/Canvas/background.test.tsx
// Verifies canvas background pan and zoom interaction behavior.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useBackgroundInteraction } from "./background";

const { state, setZoomAnchored, useAppStore } = vi.hoisted( () => {
    const state = {
        panzoom: { x: 0, y: 0, zoom: 1 },
        pendingConnect: null as unknown,
        setPan: vi.fn(),
        setZoomAnchored: vi.fn(),
        cancelPending: vi.fn(),
        beginSelectionMarquee: vi.fn(),
        cancelSelectionMarquee: vi.fn(),
    };
    const useAppStore = Object.assign(
        ( selector: ( value: typeof state ) => unknown ) => selector( state ),
        { getState: () => state }
    );

    return {
        state,
        setZoomAnchored: state.setZoomAnchored,
        useAppStore,
    };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

function TestCanvasBackground() {
    const svgRef = useRef<SVGSVGElement | null>( null );
    const { onMouseDownBackground, onWheel } = useBackgroundInteraction( {
        svgRef,
        clientToGroupPoint: () => ( { x: 20, y: 30 } ),
        setCanvasMenu: vi.fn(),
        setNodeMenu: vi.fn(),
        setActionMenu: vi.fn(),
        setAllClosed: vi.fn(),
    } );

    return (
        <svg
            ref={ svgRef }
            aria-label="Canvas background"
            onMouseDown={ onMouseDownBackground }
            onWheel={ onWheel }
        />
    );
}

describe( "useBackgroundInteraction", () => {
    afterEach( () => {
        state.pendingConnect = null;
        state.cancelPending.mockClear();
    } );

    it( "unit: keeps target selection pending when the background receives a secondary click", () => {
        state.pendingConnect = { mode: "action-to-target" };
        render( <TestCanvasBackground /> );

        fireEvent.mouseDown( screen.getByLabelText( "Canvas background" ), { button: 2 } );

        expect( state.cancelPending ).not.toHaveBeenCalled();
    } );

    it( "does not force wheel zoom-out up to the contain zoom", () => {
        render( <TestCanvasBackground /> );

        fireEvent.wheel( screen.getByLabelText( "Canvas background" ), {
            deltaY: 100,
            clientX: 10,
            clientY: 15,
        } );

        expect( setZoomAnchored ).toHaveBeenCalledWith( 0.9, { x: 20, y: 30 } );
    } );
} );
