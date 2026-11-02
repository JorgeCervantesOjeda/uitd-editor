// src/App.test.tsx
// Verifies collapse and accessible keyboard resizing for the UITDL editor sidebar.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
    interactionState,
    onActionDoubleClick,
    onCanvasToolbarAction,
    onCanvasWheel,
    onTargetNodeMouseDown,
    onTargetNodeEscape,
} = vi.hoisted( () => ( {
    interactionState: { pendingConnect: null as unknown },
    onActionDoubleClick: vi.fn(),
    onCanvasToolbarAction: vi.fn(),
    onCanvasWheel: vi.fn(),
    onTargetNodeMouseDown: vi.fn(),
    onTargetNodeEscape: vi.fn(),
} ) );

vi.mock( "./state/store", () => ( {
    useAppStore: {
        getState: () => interactionState,
    },
} ) );

vi.mock( "./components/Canvas/Canvas", () => ( {
    default: () => (
        <div aria-label="Mock canvas" onWheel={ onCanvasWheel }>
            <button type="button" onClick={ onCanvasToolbarAction }>Canvas toolbar action</button>
            <button type="button" onDoubleClick={ onActionDoubleClick }>Action</button>
            <button
                type="button"
                data-node-id="1"
                onMouseDown={ onTargetNodeMouseDown }
                onKeyDown={ event => {
                    if ( event.key === "Escape" ) onTargetNodeEscape();
                } }
            >
                Target UI
            </button>
        </div>
    ),
} ) );

vi.mock( "./components/UITDLTextPanel/UITDLTextPanel", () => ( {
    UITDLTextPanel: ( { onCollapse }: { onCollapse: () => void } ) => (
        <aside aria-label="UITDL text editor">
            <button type="button" onClick={ onCollapse }>Collapse editor</button>
        </aside>
    ),
} ) );

import App from "./App";

describe( "App UITDL sidebar", () => {
    afterEach( () => {
        interactionState.pendingConnect = null;
        onActionDoubleClick.mockClear();
        onCanvasToolbarAction.mockClear();
        onCanvasWheel.mockClear();
        onTargetNodeMouseDown.mockClear();
        onTargetNodeEscape.mockClear();
    } );

    it( "system: permits only a target UI pointer interaction or Escape during target selection", () => {
        interactionState.pendingConnect = { mode: "action-to-target" };
        render( <App /> );

        fireEvent.click( screen.getByRole( "button", { name: "Canvas toolbar action" } ) );
        fireEvent.doubleClick( screen.getByRole( "button", { name: "Action" } ) );
        fireEvent.click( screen.getByRole( "button", { name: "Collapse editor" } ) );
        fireEvent.wheel( screen.getByLabelText( "Mock canvas" ), { deltaY: -100 } );
        expect( onCanvasToolbarAction ).not.toHaveBeenCalled();
        expect( onActionDoubleClick ).not.toHaveBeenCalled();
        expect( onCanvasWheel ).not.toHaveBeenCalled();
        expect( screen.getByRole( "button", { name: "Expand UITDL text editor" } )
            .getAttribute( "aria-expanded" ) ).toBe( "true" );

        const target = screen.getByRole( "button", { name: "Target UI" } );
        fireEvent.mouseDown( target );
        fireEvent.keyDown( target, { key: "Escape" } );
        expect( onTargetNodeMouseDown ).toHaveBeenCalledTimes( 1 );
        expect( onTargetNodeEscape ).toHaveBeenCalledTimes( 1 );
    } );

    it( "collapses toward the left and expands without recreating the sidebar", () => {
        render( <App /> );

        fireEvent.click( screen.getByRole( "button", { name: "Collapse editor" } ) );
        const expandButton = screen.getByRole( "button", { name: "Expand UITDL text editor" } );
        expect( expandButton.getAttribute( "aria-expanded" ) ).toBe( "false" );

        fireEvent.click( expandButton );
        expect( screen.getByRole( "separator", { name: "Resize UITDL text editor" } ) ).toBeTruthy();
    } );

    it( "resizes the expanded sidebar with the keyboard", () => {
        render( <App /> );
        const separator = screen.getByRole( "separator", { name: "Resize UITDL text editor" } );

        expect( separator.getAttribute( "aria-valuenow" ) ).toBe( "640" );
        fireEvent.keyDown( separator, { key: "ArrowRight" } );
        expect( separator.getAttribute( "aria-valuenow" ) ).toBe( "660" );
    } );
} );
