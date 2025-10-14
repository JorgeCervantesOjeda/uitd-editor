import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import type { AppState } from "../state/store";
import { PAD_X, PAD_Y, TITLE_LINE_H, ID_FONT_SIZE } from "../model/types";
import { measureNodeSize, measureActionOval } from "../layout/measurement";
import CanvasMenu from "./ContextMenus/CanvasMenu";
import NodeMenu from "./ContextMenus/NodeMenu";
import ActionMenu from "./ContextMenus/ActionMenu";

export default function Canvas() {
    const hostRef = useRef<HTMLDivElement | null>( null );
    const svgRef = useRef<SVGSVGElement | null>( null );
    const gRef = useRef<SVGGElement | null>( null );

    // Estado global
    const panzoom = useAppStore( ( s: AppState ) => s.panzoom );
    const setPan = useAppStore( ( s: AppState ) => s.setPan );
    const setZoomAnchored = useAppStore( ( s: AppState ) => s.setZoomAnchored );

    const viewBox = useAppStore( ( s: AppState ) => s.viewBox );
    const setViewBox = useAppStore( ( s: AppState ) => s.setViewBox );

    const nodes = useAppStore( ( s: AppState ) => s.nodes );
    const actions = useAppStore( ( s: AppState ) => s.actions );
    const edges = useAppStore( ( s: AppState ) => s.edges );

    const selection = useAppStore( ( s: AppState ) => s.selection );
    const selectionActions = useAppStore( ( s: AppState ) => s.selectionActions );

    const createNodeAt = useAppStore( ( s: AppState ) => s.createNodeAt );
    const addActionForNode = useAppStore( ( s: AppState ) => s.addActionForNode );

    const selectSingleOrKeep = useAppStore( ( s: AppState ) => s.selectSingleOrKeep );
    const toggleSelect = useAppStore( ( s: AppState ) => s.toggleSelect );

    const selectSingleOrKeepAction = useAppStore( ( s: AppState ) => s.selectSingleOrKeepAction );
    const toggleSelectAction = useAppStore( ( s: AppState ) => s.toggleSelectAction );

    const clearSelection = useAppStore( ( s: AppState ) => s.clearSelection );

    const beginCombinedDrag = useAppStore( ( s: AppState ) => s.beginCombinedDrag );
    const updateCombinedDrag = useAppStore( ( s: AppState ) => s.updateCombinedDrag );
    const endCombinedDrag = useAppStore( ( s: AppState ) => s.endCombinedDrag );

    const renameNode = useAppStore( ( s: AppState ) => s.renameNode );
    const deleteSelected = useAppStore( ( s: AppState ) => s.deleteSelected );

    const pending = useAppStore( ( s: AppState ) => s.pendingConnect );
    const beginGoToTarget = useAppStore( ( s: AppState ) => s.beginGoToTarget );
    const updatePendingMouse = useAppStore( ( s: AppState ) => s.updatePendingMouse );
    const commitTargetToNode = useAppStore( ( s: AppState ) => s.commitTargetToNode );
    const cancelPending = useAppStore( ( s: AppState ) => s.cancelPending );

    // Menús (estado local)
    const [ canvasMenu, setCanvasMenu ] = useState<{ open: boolean; x: number; y: number }>( { open: false, x: 0, y: 0 } );
    const [ nodeMenu, setNodeMenu ] = useState<{ open: boolean; x: number; y: number; id: number | null }>( { open: false, x: 0, y: 0, id: null } );
    const [ actionMenu, setActionMenu ] = useState<{ open: boolean; x: number; y: number; id: number | null }>( { open: false, x: 0, y: 0, id: null } );

    // viewBox = tamaño real
    useLayoutEffect( () => {
        const host = hostRef.current;
        if ( !host ) return;
        const apply = () => {
            const rect = host.getBoundingClientRect();
            setViewBox( Math.max( 1, Math.floor( rect.width ) ), Math.max( 1, Math.floor( rect.height ) ) );
        };
        apply();
        const ro = new ResizeObserver( apply );
        ro.observe( host );
        return () => ro.disconnect();
    }, [ setViewBox ] );

    // helpers coord
    function toSvgPoint( evt: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        const svg = svgRef.current;
        if ( !svg ) return { x: evt.clientX, y: evt.clientY };
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX; pt.y = evt.clientY;
        const ctm = svg.getScreenCTM(); if ( !ctm ) return { x: evt.clientX, y: evt.clientY };
        const inv = ctm.inverse();
        const sp = pt.matrixTransform( inv );
        return { x: sp.x, y: sp.y };
    }
    function clientToGroupPoint( clientX: number, clientY: number ) {
        const g = gRef.current;
        if ( !g ) return { x: clientX, y: clientY };
        const svg = g.ownerSVGElement as SVGSVGElement;
        const pt = svg.createSVGPoint();
        pt.x = clientX; pt.y = clientY;
        const ctm = g.getScreenCTM(); if ( !ctm ) return { x: clientX, y: clientY };
        const inv = ctm.inverse();
        const gp = pt.matrixTransform( inv );
        return { x: gp.x, y: gp.y };
    }

    // Pan (fondo)
    const draggingPanRef = useRef( false );
    const lastSvgPtRef = useRef<{ x: number; y: number }>( { x: 0, y: 0 } );

    function onMouseDownBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        if ( e.button !== 0 ) return;
        draggingPanRef.current = true;
        const p = toSvgPoint( e );
        lastSvgPtRef.current = { x: p.x, y: p.y };
        svgRef.current?.parentElement?.classList.add( "is-grabbing" );
        setCanvasMenu( { open: false, x: 0, y: 0 } );
        setNodeMenu( { open: false, x: 0, y: 0, id: null } );
        setActionMenu( { open: false, x: 0, y: 0, id: null } );
        if ( !e.shiftKey ) clearSelection();
        if ( pending ) cancelPending();
    }
    function onMouseMoveBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        if ( pending ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updatePendingMouse( gp );
        }
        if ( !draggingPanRef.current ) return;
        const p = toSvgPoint( e );
        setPan( p.x - lastSvgPtRef.current.x, p.y - lastSvgPtRef.current.y );
        lastSvgPtRef.current = p;
    }
    function endPanDrag() {
        if ( !draggingPanRef.current ) return;
        draggingPanRef.current = false;
        svgRef.current?.parentElement?.classList.remove( "is-grabbing" );
    }

    // Zoom (rueda)
    function onWheel( e: React.WheelEvent<SVGSVGElement> ) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = panzoom.zoom * factor;
        const gp = clientToGroupPoint( e.clientX, e.clientY );
        setZoomAnchored( newZoom, gp );
    }

    // Menú del fondo
    function onContextMenuHost( e: React.MouseEvent ) {
        e.preventDefault();
        setNodeMenu( { open: false, x: 0, y: 0, id: null } );
        setActionMenu( { open: false, x: 0, y: 0, id: null } );
        setCanvasMenu( { open: true, x: e.clientX, y: e.clientY } );
    }
    function createNodeFromCanvasMenu() {
        const world = clientToGroupPoint( canvasMenu.x, canvasMenu.y );
        const title = `Node`;
        const wrap = 22;
        const m = measureNodeSize( title, wrap );
        createNodeAt( world.x - m.w / 2, world.y - m.h / 2 );
    }

    // Node interactions
    function onNodeMouseDown( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;

        if ( pending && pending.mode === "action-to-target" ) {
            commitTargetToNode( id );
            return;
        }

        if ( e.shiftKey ) {
            toggleSelect( id );
        } else {
            const already = selection.has( id );
            selectSingleOrKeep( id, already );
        }

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        if ( !selNodes.has( id ) ) selNodes.add( id );
        const gp = clientToGroupPoint( e.clientX, e.clientY );
        beginCombinedDrag( gp, selNodes, selActions );
    }

    // Action interactions
    function onActionMouseDown( e: React.MouseEvent, actionId: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;

        // Si estamos en rubber-banding, ignoramos drags de la acción
        if ( pending ) return;

        if ( e.shiftKey ) {
            toggleSelectAction( actionId );
        } else {
            const already = selectionActions.has( actionId );
            selectSingleOrKeepAction( actionId, already );
        }

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        if ( !selActions.has( actionId ) ) selActions.add( actionId );
        const gp = clientToGroupPoint( e.clientX, e.clientY );
        beginCombinedDrag( gp, selNodes, selActions );
    }

    function onMouseMoveCombined( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        if ( pending ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updatePendingMouse( gp );
        }
        if ( useAppStore.getState().drag.active ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updateCombinedDrag( gp );
            return;
        }
        onMouseMoveBackground( e );
    }

    function endCombined() {
        if ( useAppStore.getState().drag.active ) endCombinedDrag();
    }

    function onNodeDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        const node = useAppStore.getState().nodes.find( n => n.id === id );
        if ( !node ) return;
        const newTitle = window.prompt( "Rename node title:", node.title );
        if ( newTitle == null ) return;
        renameNode( id, newTitle );
    }

    function onContextMenuNode( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selection.has( id ) ) {
            selectSingleOrKeep( id, false );
        }
        setCanvasMenu( { open: false, x: 0, y: 0 } );
        setActionMenu( { open: false, x: 0, y: 0, id: null } );
        setNodeMenu( { open: true, x: e.clientX, y: e.clientY, id } );
    }

    function onContextMenuAction( e: React.MouseEvent, actionId: number ) {
        e.preventDefault();
        e.stopPropagation();
        setCanvasMenu( { open: false, x: 0, y: 0 } );
        setNodeMenu( { open: false, x: 0, y: 0, id: null } );
        setActionMenu( { open: true, x: e.clientX, y: e.clientY, id: actionId } );
    }

    // Teclado (Delete / ESC)
    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            if ( e.key === "Delete" || e.key === "Backspace" ) {
                if ( selection.size > 0 || selectionActions.size > 0 ) deleteSelected();
            }
            if ( e.key === "Escape" ) {
                setCanvasMenu( { open: false, x: 0, y: 0 } );
                setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                setActionMenu( { open: false, x: 0, y: 0, id: null } );
                if ( pending ) cancelPending();
            }
        }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ deleteSelected, pending, cancelPending, selection.size, selectionActions.size ] );

    // === helpers de centros para aristas ===
    function nodeCenter( n: { x: number; y: number; title: string; wrap?: number } ) {
        const m = measureNodeSize( n.title, n.wrap ?? 22 );
        return { cx: n.x + m.w / 2, cy: n.y + m.h / 2, w: m.w, h: m.h, lines: m.lines };
    }
    function actionCenter( a: { x: number; y: number; title: string; wrap?: number } ) {
        const m = measureActionOval( a.title, a.wrap ?? 22 );
        return { cx: a.x, cy: a.y, w: m.w, h: m.h, lines: m.lines }; // acción guardada centrada
    }

    return (
        <div
            ref={ hostRef }
            style={ { position: "absolute", inset: 0, background: "#fff", cursor: "grab" } }
            onContextMenu={ ( e ) => e.preventDefault() }
            className="canvas"
        >
            <svg
                ref={ svgRef }
                width="100%"
                height="100%"
                viewBox={ `0 0 ${viewBox.w} ${viewBox.h}` }
                preserveAspectRatio="xMidYMid meet"
                onMouseDown={ onMouseDownBackground }
                onMouseMove={ onMouseMoveCombined }
                onMouseUp={ () => { endPanDrag(); endCombined(); } }
                onMouseLeave={ () => { endPanDrag(); endCombined(); } }
                onWheel={ onWheel }
                onContextMenu={ onContextMenuHost }
            >
                <g ref={ gRef } transform={ `translate(${panzoom.x} ${panzoom.y}) scale(${panzoom.zoom})` }>
                    {/* === CAPA DE ARISTAS === */ }
                    <g>
                        { edges.map( ( e ) => {
                            let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

                            if ( e.from.kind === "node" ) {
                                const n = nodes.find( n => n.id === e.from.id );
                                if ( !n ) return null;
                                const c = nodeCenter( n );
                                x1 = c.cx; y1 = c.cy;
                            } else {
                                const a = actions.find( a => a.id === e.from.id );
                                if ( !a ) return null;
                                const c = actionCenter( a );
                                x1 = c.cx; y1 = c.cy;
                            }

                            if ( e.to.kind === "node" ) {
                                const n = nodes.find( n => n.id === e.to.id );
                                if ( !n ) return null;
                                const c = nodeCenter( n );
                                x2 = c.cx; y2 = c.cy;
                            } else {
                                const a = actions.find( a => a.id === e.to.id );
                                if ( !a ) return null;
                                const c = actionCenter( a );
                                x2 = c.cx; y2 = c.cy;
                            }

                            const dash = e.style === "solid" ? "" : "6 6";
                            return <line key={ e.id } x1={ x1 } y1={ y1 } x2={ x2 } y2={ y2 } stroke="#334155" strokeWidth={ 1.5 } strokeDasharray={ dash } />;
                        } ) }

                        {/* Rubber-banding: acción -> cursor */ }
                        { pending && pending.mode === "action-to-target" && ( () => {
                            const a = actions.find( x => x.id === pending.fromActionId );
                            if ( !a ) return null;
                            const c = actionCenter( a );
                            return <line x1={ c.cx } y1={ c.cy } x2={ pending.mouse.x } y2={ pending.mouse.y } stroke="#334155" strokeWidth={ 1.5 } strokeDasharray="4 8" />;
                        } )() }
                    </g>

                    {/* === CAPA DE NODOS Y ACCIONES === */ }
                    {/* Nodos */ }
                    { nodes.map( ( n ) => {
                        const wrap = n.wrap ?? 22;
                        const m = measureNodeSize( n.title, wrap );
                        const isSel = selection.has( n.id );
                        const stroke = isSel ? "#2563eb" : "#94a3b8";
                        const strokeWidth = isSel ? 3 : 1.5;
                        const titleX = n.x + PAD_X;

                        return (
                            <g
                                key={ n.id }
                                onMouseDown={ ( e ) => onNodeMouseDown( e, n.id ) }
                                onDoubleClick={ ( e ) => onNodeDoubleClick( e, n.id ) }
                                onContextMenu={ ( e ) => onContextMenuNode( e, n.id ) }
                            >
                                <rect x={ n.x } y={ n.y } width={ m.w } height={ m.h } fill="#f1f5f9" stroke={ stroke } strokeWidth={ strokeWidth } rx={ 4 } ry={ 4 } />
                                <text x={ titleX } y={ n.y + PAD_Y + 18 } style={ { fontSize: 18, fill: "#334155", userSelect: "none" } }>
                                    { m.lines.map( ( line, i ) => (
                                        <tspan key={ i } x={ titleX } dy={ i === 0 ? 0 : TITLE_LINE_H }>{ line }</tspan>
                                    ) ) }
                                </text>
                                <text
                                    x={ titleX }
                                    y={ n.y + PAD_Y + TITLE_LINE_H * m.lines.length + 16 }
                                    style={ { fontSize: ID_FONT_SIZE, fill: "#64748b", userSelect: "none" } }
                                >
                                    id={ n.id }
                                </text>
                            </g>
                        );
                    } ) }

                    {/* Acciones (óvalos) */ }
                    { actions.map( ( a ) => {
                        const m = measureActionOval( a.title, a.wrap ?? 22 );
                        const rx = m.w / 2, ry = m.h / 2;
                        const textX = a.x;
                        const textStartY = a.y - ( m.lines.length - 1 ) * ( TITLE_LINE_H / 2 );
                        const isSel = selectionActions.has( a.id );
                        const stroke = isSel ? "#2563eb" : "#6366f1";
                        const strokeWidth = isSel ? 3 : 1.5;

                        return (
                            <g key={ a.id } onMouseDown={ ( e ) => onActionMouseDown( e, a.id ) } onContextMenu={ ( e ) => onContextMenuAction( e, a.id ) }>
                                <ellipse cx={ a.x } cy={ a.y } rx={ rx } ry={ ry } fill="#eef2ff" stroke={ stroke } strokeWidth={ strokeWidth } />
                                <text textAnchor="middle" x={ textX } y={ textStartY } style={ { fontSize: 16, fill: "#1e293b", userSelect: "none" } }>
                                    { m.lines.map( ( line, i ) => (
                                        <tspan key={ i } x={ textX } dy={ i === 0 ? 0 : TITLE_LINE_H }>{ line }</tspan>
                                    ) ) }
                                </text>
                            </g>
                        );
                    } ) }
                </g>
            </svg>

            {/* Menús */ }
            { canvasMenu.open && (
                <CanvasMenu
                    x={ canvasMenu.x }
                    y={ canvasMenu.y }
                    onNewNode={ createNodeFromCanvasMenu }
                    onClose={ () => setCanvasMenu( { open: false, x: 0, y: 0 } ) }
                />
            ) }

            { nodeMenu.open && nodeMenu.id != null && (
                <NodeMenu
                    x={ nodeMenu.x }
                    y={ nodeMenu.y }
                    onAddAction={ () => addActionForNode( nodeMenu.id! ) }
                    onRename={ () => {
                        const node = useAppStore.getState().nodes.find( n => n.id === nodeMenu.id );
                        if ( !node ) return;
                        const t = window.prompt( "Rename node title:", node.title );
                        if ( t != null ) renameNode( nodeMenu.id!, t );
                    } }
                    onDelete={ () => deleteSelected() }
                    onClose={ () => setNodeMenu( { open: false, x: 0, y: 0, id: null } ) }
                />
            ) }

            { actionMenu.open && actionMenu.id != null && (
                <ActionMenu
                    x={ actionMenu.x }
                    y={ actionMenu.y }
                    onGoToTarget={ () => beginGoToTarget( actionMenu.id! ) }
                    onClose={ () => setActionMenu( { open: false, x: 0, y: 0, id: null } ) }
                />
            ) }
        </div>
    );
}
