// src/components/Canvas/renderMenus.rigidBlocks.test.tsx
// Verifies contextual RigidBlock commands and visible disabled reasons.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RenderMenus } from "./renderMenus";

const { state, useAppStore } = vi.hoisted( () => {
    type Availability = {
        canCreate: boolean;
        canRemove: boolean;
        createReason?: string;
        createReasonCode?: string;
        rigidBlockId?: number;
    };
    const state = {
        isCanvasLockedByUITDLLiveSync: false,
        selection: new Set<number>( [ 1 ] ),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        conditions: [],
        getRigidBlockAvailability: vi.fn( (): Availability => ( {
            canCreate: true,
            canRemove: false,
        } ) ),
        createRigidBlockFromSelection: vi.fn( () => ( { ok: true } ) ),
        removeRigidBlockFromSelection: vi.fn( () => true ),
        addActionForNode: vi.fn(),
        deleteSelected: vi.fn(),
        handleCreateCondition: vi.fn(),
        retargetCondition: vi.fn(),
        beginGoToTarget: vi.fn(),
        renameCondition: vi.fn(),
    };
    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    return { state, useAppStore };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

function renderNodeMenu( setNodeMenu = vi.fn() ) {
    return render(
        <RenderMenus
            canvasMenu={ { open: false, x: 0, y: 0 } }
            nodeMenu={ { open: true, x: 10, y: 20, id: 1 } }
            actionMenu={ { open: false, x: 0, y: 0, id: null } }
            conditionMenu={ { open: false, x: 0, y: 0, id: null } }
            onCreateNode={ vi.fn() }
            setCanvasMenu={ vi.fn() }
            setNodeMenu={ setNodeMenu }
            setActionMenu={ vi.fn() }
            setConditionMenu={ vi.fn() }
            openNodeEditDialog={ vi.fn() }
            openActionEditDialog={ vi.fn() }
            onFitSelectionToView={ vi.fn() }
        />
    );
}

describe( "RenderMenus RigidBlock commands", () => {
    it( "offersCreateRigidBlockForValidSelection", () => {
        const setNodeMenu = vi.fn();
        renderNodeMenu( setNodeMenu );

        fireEvent.click( screen.getByRole( "button", { name: "Create rigid block" } ) );

        expect( state.createRigidBlockFromSelection ).toHaveBeenCalledTimes( 1 );
        expect( setNodeMenu ).toHaveBeenCalledWith( { open: false, x: 0, y: 0, id: null } );
    } );

    it( "disablesCreateForMultiFragmentSelection", () => {
        state.getRigidBlockAvailability.mockReturnValue( {
            canCreate: false,
            canRemove: false,
            createReason: "A rigid block can contain elements from only one fragment.",
            createReasonCode: "multiple-fragments",
        } );
        renderNodeMenu();

        const button = screen.getByRole( "button", { name: "Create rigid block" } );
        expect( ( button as HTMLButtonElement ).disabled ).toBe( true );
        expect( button.getAttribute( "title" ) ).toContain( "only one fragment" );
    } );

    it( "disablesCreateForOverlappingMembership", () => {
        state.getRigidBlockAvailability.mockReturnValue( {
            canCreate: false,
            canRemove: false,
            createReason: "One or more selected elements already belong to a rigid block.",
            createReasonCode: "member-overlap",
        } );
        renderNodeMenu();

        const button = screen.getByRole( "button", { name: "Create rigid block" } );
        expect( ( button as HTMLButtonElement ).disabled ).toBe( true );
        expect( button.getAttribute( "title" ) ).toContain( "already belong" );
    } );

    it( "offersRemoveForSelectedBlock", () => {
        state.getRigidBlockAvailability.mockReturnValue( {
            canCreate: false,
            canRemove: true,
            rigidBlockId: 5,
        } );
        const setNodeMenu = vi.fn();
        renderNodeMenu( setNodeMenu );

        fireEvent.click( screen.getByRole( "button", { name: "Remove rigid block" } ) );

        expect( state.removeRigidBlockFromSelection ).toHaveBeenCalledTimes( 1 );
        expect( setNodeMenu ).toHaveBeenCalledWith( { open: false, x: 0, y: 0, id: null } );
    } );
} );
