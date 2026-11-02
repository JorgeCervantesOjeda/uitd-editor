// Verifies node target-selection behavior linked to the App target-selection system scenario.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { state, commitTargetToNode, openNodeEditDialog, useAppStore } = vi.hoisted( () => {
    const state = {
        nodes: [],
        selection: new Set<number>(),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        focusTarget: null,
        pendingConnect: null as unknown,
        isCanvasLockedByUITDLLiveSync: false,
        dragHoverParent: null,
        selectSingleOrKeep: vi.fn(),
        toggleSelect: vi.fn(),
        beginCombinedDrag: vi.fn(),
        setFocusTarget: vi.fn(),
        moveFocusInDirection: vi.fn(),
        extendKeyboardMarquee: vi.fn(),
    };
    const commitTargetToNode = vi.fn( () => { state.pendingConnect = null; } );
    const currentState = () => ( { ...state, commitTargetToNode } );
    const useAppStore = Object.assign(
        ( selector: ( value: ReturnType<typeof currentState> ) => unknown ) => selector( currentState() ),
        { getState: currentState }
    );
    return {
        state,
        commitTargetToNode,
        openNodeEditDialog: vi.fn(),
        useAppStore,
    };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );
vi.mock( "../../layout/measurement", () => ( {
    getNodeSizeCached: () => ( { w: 120, h: 60, lines: [ "Target" ] } ),
} ) );
vi.mock( "./menuBus", () => ( {
    useMenuBus: () => ( {
        openNodeEditDialog,
        openNodeMenu: vi.fn(),
    } ),
} ) );
vi.mock( "./useFragmentSelection", () => ( {
    useFragmentSelection: () => ( { nodeIds: new Set<number>() } ),
} ) );
vi.mock( "./ElementWidthHandle", () => ( { ElementWidthHandle: () => null } ) );

import { NodesLayer } from "./nodes";

describe( "NodesLayer target selection", () => {
    afterEach( () => {
        state.pendingConnect = null;
        commitTargetToNode.mockClear();
        openNodeEditDialog.mockClear();
    } );

    it( "integration: accepts only the primary button to select the target UI", () => {
        state.pendingConnect = { mode: "action-to-target" };
        render(
            <svg>
                <NodesLayer nodesOverride={ [ { id: 1, x: 100, y: 100, title: "Target" } ] } />
            </svg>
        );

        const target = screen.getByRole( "button", { name: "Node 1: Target" } );
        fireEvent.mouseDown( target, { button: 2 } );
        expect( commitTargetToNode ).not.toHaveBeenCalled();

        fireEvent.mouseDown( target, { button: 0 } );
        expect( commitTargetToNode ).toHaveBeenCalledWith( 1 );
    } );

    it( "integration: does not open the selected target UI after a double click", () => {
        state.pendingConnect = { mode: "action-to-target" };
        render(
            <svg>
                <NodesLayer nodesOverride={ [ { id: 1, x: 100, y: 100, title: "Target" } ] } />
            </svg>
        );

        const target = screen.getByRole( "button", { name: "Node 1: Target" } );
        fireEvent.mouseDown( target, { button: 0, detail: 1 } );
        fireEvent.mouseDown( target, { button: 0, detail: 2 } );
        fireEvent.doubleClick( target );

        expect( openNodeEditDialog ).not.toHaveBeenCalled();
    } );
} );
