// src/components/Canvas/TopToolbar/menus/EditMenu.test.tsx
// Verifies edit commands exposed by the toolbar menu.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditMenu } from "./EditMenu";

const { state, useAppStore } = vi.hoisted( () => {
    const state = {
        historyUndo: [],
        historyRedo: [],
        isCanvasLockedByUITDLLiveSync: false,
        undo: vi.fn(),
        redo: vi.fn(),
        selectAll: vi.fn(),
    };

    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    return { state, useAppStore };
} );

vi.mock( "../../../../state/store", () => ( { useAppStore } ) );

describe( "EditMenu", () => {
    it( "selects all diagram elements from the Edit menu", () => {
        render( <EditMenu /> );

        fireEvent.click( screen.getByRole( "menuitem", { name: "Select all" } ) );

        expect( state.selectAll ).toHaveBeenCalledTimes( 1 );
    } );
} );
