// src/components/Canvas/fragmentSelection.test.tsx
// Verifies whole-fragment highlighting through real selection and rendering paths.

import { useRef } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";
import { FragmentFramesLayer } from "./FragmentFramesLayer";
import { NodesLayer } from "./nodes";
import { ActionsLayer } from "./actions";
import { MenuBusProvider } from "./menuBus";
import { useBackgroundInteraction } from "./background";

const initialState = useAppStore.getState();
const selectionMark = '[data-export="ignore"][stroke-dasharray="4 8"]';

function SelectionCanvas() {
    const svgRef = useRef<SVGSVGElement | null>( null );
    const background = useBackgroundInteraction( {
        svgRef,
        clientToGroupPoint: ( x, y ) => ( { x, y } ),
        setCanvasMenu: vi.fn(), setNodeMenu: vi.fn(), setActionMenu: vi.fn(), setAllClosed: vi.fn(),
    } );
    return (
        <MenuBusProvider value={ {
            openNodeMenu: vi.fn(), openActionMenu: vi.fn(), openConditionMenu: vi.fn(),
            openNodeEditDialog: vi.fn(), openActionEditDialog: vi.fn(),
            openConditionEditDialog: vi.fn(), closeAll: vi.fn(),
        } }>
            <svg ref={ svgRef } onMouseDown={ background.onMouseDownBackground }
                onMouseMove={ background.onMouseMoveBackground } onMouseUp={ background.endPanDrag }>
                <FragmentFramesLayer hoveredFragmentId={ null } setHoveredFragmentId={ vi.fn() } />
                <NodesLayer />
                <ActionsLayer />
            </svg>
        </MenuBusProvider>
    );
}

describe( "fragment selection highlighting", () => {
    beforeEach( () => {
        useAppStore.setState( {
            nodes: [
                { id: 1, title: "Start", x: 100, y: 100 },
                { id: 2, title: "Child", x: 100, y: 180, parentId: 1 },
                { id: 3, title: "Other", x: 1100, y: 100 },
            ],
            actions: [ { id: 1, originNodeId: 1, title: "clicks Continue", verb: "clicks", complement: "Continue", x: 300, y: 100 } ],
            conditions: [ { id: 1, originActionId: 1, title: "Ready", x: 500, y: 100 } ],
            edges: [], fragmentTitles: {},
            selection: new Set(), selectionActions: new Set(), selectionConds: new Set(),
            focusTarget: null, pendingConnect: null,
        } );
    } );

    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "highlights the frame instead of members after a direct click", () => {
        const { container } = render( <SelectionCanvas /> );
        const frame = container.querySelector( '.fragmentFrameGroup > rect' )!;
        fireEvent.mouseDown( frame, { button: 0, clientX: 20, clientY: 20 } );
        fireEvent.mouseUp( frame, { button: 0, clientX: 20, clientY: 20 } );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 1 );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 0 );
        expect( useAppStore.getState().selection ).toEqual( new Set( [ 1, 2 ] ) );
        expect( useAppStore.getState().selectionActions ).toEqual( new Set( [ 1 ] ) );
        expect( useAppStore.getState().selectionConds ).toEqual( new Set( [ 1 ] ) );
    } );

    it( "promotes complete selection and restores individual marks when a member is deselected", () => {
        const { container } = render( <SelectionCanvas /> );
        act( () => {
            useAppStore.getState().toggleSelect( 1 );
            useAppStore.getState().toggleSelectAction( 1 );
        } );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 3 );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 0 );
        act( () => useAppStore.getState().toggleSelectCondition( 1 ) );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 1 );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 0 );
        act( () => useAppStore.getState().toggleSelectCondition( 1 ) );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 0 );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 3 );
    } );

    it( "highlights complete fragments independently during marquee selection and clears them", () => {
        const { container } = render( <SelectionCanvas /> );
        const svg = container.querySelector( "svg" )!;
        fireEvent.mouseDown( svg, { button: 0, clientX: 0, clientY: 0 } );
        fireEvent.mouseMove( svg, { clientX: 700, clientY: 300 } );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 1 );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 0 );
        fireEvent.mouseMove( svg, { clientX: 1300, clientY: 300 } );
        fireEvent.mouseUp( svg );
        expect( container.querySelectorAll( `.fragmentFrameGroup ${selectionMark}` ) ).toHaveLength( 2 );
        expect( container.querySelectorAll( `[data-kbd-kind] ${selectionMark}` ) ).toHaveLength( 0 );
        fireEvent.mouseDown( svg, { button: 0, clientX: 1500, clientY: 500 } );
        fireEvent.mouseUp( svg );
        expect( container.querySelectorAll( selectionMark ) ).toHaveLength( 0 );
    } );
} );
