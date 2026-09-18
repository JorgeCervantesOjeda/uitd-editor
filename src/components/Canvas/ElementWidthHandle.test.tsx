// src/components/Canvas/ElementWidthHandle.test.tsx
// Exercises rendered resize handles, zoom conversion, cancellation, and keyboard resizing.

import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";
import { withMeasuredNodeBox, withMeasuredActionLabel, withMeasuredConditionLabel } from "../../layout/measurement";
import { NodesLayer } from "./nodes";
import { ActionsLayer } from "./actions";
import { MenuBusProvider } from "./menuBus";
import { NodeEditDialog } from "./NodeEditDialog";
import { ActionEditDialog } from "./ActionEditDialog";
import { ConditionEditDialog } from "./ConditionEditDialog";

const initial = useAppStore.getState();
class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor( type: string, options: PointerEventInit = {} ) {
        super( type, options );
        this.pointerId = options.pointerId ?? 1;
    }
}

function renderCanvas() {
    return render( <MenuBusProvider value={ {
        openNodeMenu: vi.fn(), openActionMenu: vi.fn(), openConditionMenu: vi.fn(),
        openNodeEditDialog: vi.fn(), openActionEditDialog: vi.fn(), openConditionEditDialog: vi.fn(), closeAll: vi.fn(),
    } }><svg><NodesLayer /><ActionsLayer /></svg></MenuBusProvider> );
}

describe( "right edge resizing", () => {
    beforeEach( () => {
        vi.stubGlobal( "PointerEvent", TestPointerEvent );
        Object.defineProperty( SVGElement.prototype, "getScreenCTM", {
            configurable: true, value: () => ( { inverse: () => ( { a: 0.5, c: 0 } ) } ),
        } );
        const title = "Alpha Beta Gamma Delta";
        useAppStore.setState( {
            ...initial,
            nodes: [ withMeasuredNodeBox( { id: 1, displayId: "1", title, x: 200, y: 200, wrap: 10 } ) ],
            actions: [ withMeasuredActionLabel( { id: 1, originNodeId: 1, title, verb: "clicks", complement: title, x: 400, y: 200, wrap: 10 } ) ],
            conditions: [ withMeasuredConditionLabel( { id: 1, originActionId: 1, title, x: 600, y: 200, wrap: 10 } ) ],
        }, true );
    } );
    afterEach( () => {
        vi.unstubAllGlobals();
        Reflect.deleteProperty( SVGElement.prototype, "getScreenCTM" );
        useAppStore.setState( initial, true );
    } );

    it.each( [
        { kind: "node", key: "nodes" as const, shape: "rect" },
        { kind: "action", key: "actions" as const, shape: "ellipse" },
        { kind: "condition", key: "conditions" as const, shape: "polygon" },
    ] )( "drags the $kind edge at 2x zoom without starting a move or marquee", ( { kind, key, shape } ) => {
        const before = useAppStore.getState()[ key ][ 0 ];
        const { container } = renderCanvas();
        const handle = screen.getByRole( "separator", { name: `Resize ${kind} width` } );
        fireEvent.pointerDown( handle, { button: 0, clientX: 200, clientY: 100 } );
        fireEvent.pointerMove( window, { clientX: 160, clientY: 100 } );
        const next = useAppStore.getState()[ key ][ 0 ];
        expect( next.w ).toBe( before.w! - 20 );
        expect( next.x - next.w! / 2 ).toBe( before.x - before.w! / 2 );
        expect( useAppStore.getState().drag.active ).toBe( false );
        expect( useAppStore.getState().keyboardMarquee ).toBeNull();
        const rendered = container.querySelector( `[data-kbd-kind="${kind}"] > ${shape}` )!;
        if ( kind === "node" ) expect( Number( rendered.getAttribute( "width" ) ) ).toBe( next.w );
        if ( kind === "action" ) expect( Number( rendered.getAttribute( "rx" ) ) * 2 ).toBe( next.w );
        if ( kind === "condition" ) expect( rendered.getAttribute( "points" ) ).toContain( `${next.x + next.w! / 2},${next.y}` );
        fireEvent.pointerMove( window, { clientX: 140, clientY: 100 } );
        fireEvent.pointerUp( window );
        expect( useAppStore.getState().historyUndo ).toHaveLength( 1 );
        act( () => useAppStore.getState().undo() );
        expect( useAppStore.getState()[ key ][ 0 ] ).toEqual( before );
    } );

    it( "restores the original geometry when Escape cancels a drag", () => {
        const before = useAppStore.getState().nodes;
        renderCanvas();
        fireEvent.pointerDown( screen.getByRole( "separator", { name: "Resize node width" } ), { button: 0, clientX: 100 } );
        fireEvent.pointerMove( window, { clientX: 300 } );
        fireEvent.keyDown( window, { key: "Escape" } );
        expect( useAppStore.getState().nodes ).toEqual( before );
        expect( useAppStore.getState().historyUndo ).toHaveLength( 0 );
        fireEvent.pointerMove( window, { clientX: 400 } );
        expect( useAppStore.getState().nodes ).toEqual( before );
    } );

    it( "supports arrow keys and hides handles when live sync locks the canvas", () => {
        renderCanvas();
        const before = useAppStore.getState().nodes[ 0 ];
        fireEvent.keyDown( screen.getByRole( "separator", { name: "Resize node width" } ), { key: "ArrowRight" } );
        expect( useAppStore.getState().nodes[ 0 ].w ).toBe( before.w! + 9 );
        act( () => useAppStore.setState( { isCanvasLockedByUITDLLiveSync: true } ) );
        expect( screen.queryAllByRole( "separator" ) ).toHaveLength( 0 );
    } );

    it.each( [
        { kind: "node", key: "nodes" as const },
        { kind: "action", key: "actions" as const },
        { kind: "condition", key: "conditions" as const },
    ].flatMap( item => [ { ...item, whitespace: false }, { ...item, whitespace: true } ] ) )(
        "resizes the $kind preview and preserves it on close (trailing whitespace: $whitespace)", ( { kind, key, whitespace } ) => {
        useAppStore.setState( { actions: [ withMeasuredActionLabel( {
            ...useAppStore.getState().actions[ 0 ], title: 'clicks "Alpha Beta Gamma Delta"',
        } ) ] } );
        if ( whitespace ) {
            const current = useAppStore.getState();
            useAppStore.setState( {
                nodes: current.nodes.map( item => ( { ...item, title: `${item.title} ` } ) ),
                actions: current.actions.map( item => ( { ...item, complement: `${item.complement} `, title: `clicks "${item.complement} "` } ) ),
                conditions: current.conditions.map( item => ( { ...item, title: `${item.title} ` } ) ),
            } );
        }
        const before = useAppStore.getState()[ key ][ 0 ];
        const onClose = vi.fn();
        const { container, unmount } = render( kind === "node"
            ? <NodeEditDialog open nodeId={ 1 } onClose={ onClose } />
            : kind === "action" ? <ActionEditDialog open actionId={ 1 } onClose={ onClose } />
                : <ConditionEditDialog open conditionId={ 1 } onClose={ onClose } /> );
        expect( screen.queryByRole( "spinbutton" ) ).toBeNull();
        const session = useAppStore.getState().editingSession;
        fireEvent.pointerDown( screen.getByRole( "separator", { name: `Resize ${kind} width` } ), { button: 0, clientX: 200 } );
        fireEvent.pointerMove( window, { clientX: 240 } );
        fireEvent.pointerUp( window );
        const resized = useAppStore.getState()[ key ][ 0 ];
        expect( resized.w ).toBe( before.w! + 20 );
        expect( useAppStore.getState().editingSession ).toBe( session );
        expect( useAppStore.getState().historyUndo ).toHaveLength( 0 );
        fireEvent.submit( container.querySelector( "form" )! );
        expect( useAppStore.getState()[ key ][ 0 ].w ).toBe( resized.w );
        expect( useAppStore.getState()[ key ][ 0 ].x ).toBe( resized.x );
        unmount();
        expect( useAppStore.getState().historyUndo ).toHaveLength( 1 );
        act( () => useAppStore.getState().undo() );
        expect( useAppStore.getState()[ key ][ 0 ] ).toEqual( before );
    } );
} );
