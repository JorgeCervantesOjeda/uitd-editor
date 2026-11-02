// Verifies keyboard behavior linked to the App target-selection system scenario.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const { state, cancelPending, undo, useAppStore } = vi.hoisted( () => {
    const state = {
        pendingConnect: null as unknown,
        isCanvasLockedByUITDLLiveSync: false,
        selection: new Set<number>(),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        deleteSelected: vi.fn(),
        cancelPending: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        copySelectionToClipboard: vi.fn(),
        pasteFromClipboard: vi.fn(),
        cancelSelectionMarquee: vi.fn(),
        cutSelectionToClipboard: vi.fn(),
    };
    const useAppStore = Object.assign(
        ( selector: ( value: typeof state ) => unknown ) => selector( state ),
        { getState: () => state }
    );
    return { state, cancelPending: state.cancelPending, undo: state.undo, useAppStore };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

import { useKeyboardShortcuts } from "./keyboard";

function KeyboardHarness() {
    useKeyboardShortcuts( {
        setCanvasMenu: vi.fn(),
        setNodeMenu: vi.fn(),
        setActionMenu: vi.fn(),
        setConditionMenu: vi.fn(),
        dialogsOpen: false,
    } );
    return <input aria-label="Outside canvas input" />;
}

describe( "useKeyboardShortcuts target selection", () => {
    afterEach( () => {
        state.pendingConnect = null;
        cancelPending.mockClear();
        undo.mockClear();
    } );

    it( "unit: blocks shortcuts and accepts Escape even when focus is outside the canvas", () => {
        state.pendingConnect = { mode: "action-to-target" };
        const { getByRole } = render( <KeyboardHarness /> );
        const input = getByRole( "textbox", { name: "Outside canvas input" } );

        fireEvent.keyDown( input, { key: "z", ctrlKey: true } );
        fireEvent.keyDown( input, { key: "Escape" } );

        expect( undo ).not.toHaveBeenCalled();
        expect( cancelPending ).toHaveBeenCalledTimes( 1 );
    } );
} );
