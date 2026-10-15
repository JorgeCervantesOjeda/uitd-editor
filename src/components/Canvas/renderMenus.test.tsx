// Verifies selection-specific navigation commands in element context menus.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RenderMenus } from "./renderMenus";

const { useAppStore, state } = vi.hoisted( () => {
    const state = {
        isCanvasLockedByUITDLLiveSync: false,
        selection: new Set<number>( [ 1 ] ),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        conditions: [],
        addActionForNode: vi.fn(),
        deleteSelected: vi.fn(),
        handleCreateCondition: vi.fn(),
        retargetCondition: vi.fn(),
        beginGoToTarget: vi.fn(),
        renameCondition: vi.fn(),
    };
    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    return { useAppStore, state };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

function renderNodeMenu( onFitSelectionToView = vi.fn() ) {
    return render(
        <RenderMenus
            canvasMenu={ { open: false, x: 0, y: 0 } }
            nodeMenu={ { open: true, x: 10, y: 20, id: 1 } }
            actionMenu={ { open: false, x: 0, y: 0, id: null } }
            conditionMenu={ { open: false, x: 0, y: 0, id: null } }
            onCreateNode={ vi.fn() }
            setCanvasMenu={ vi.fn() }
            setNodeMenu={ vi.fn() }
            setActionMenu={ vi.fn() }
            setConditionMenu={ vi.fn() }
            openNodeEditDialog={ vi.fn() }
            openActionEditDialog={ vi.fn() }
            onFitSelectionToView={ onFitSelectionToView }
        />
    );
}

describe( "RenderMenus", () => {
    it( "offers Fit selection to view for a selected element", () => {
        const onFitSelectionToView = vi.fn();

        renderNodeMenu( onFitSelectionToView );

        fireEvent.click( screen.getByRole( "button", { name: "Fit selection to view" } ) );

        expect( onFitSelectionToView ).toHaveBeenCalledTimes( 1 );
    } );

    it( "does not offer the command when there is no selection", () => {
        state.selection = new Set();
        state.selectionActions = new Set();
        state.selectionConds = new Set();

        renderNodeMenu();

        expect( screen.queryByRole( "button", { name: "Fit selection to view" } ) ).toBeNull();
    } );
} );
