// src/components/Canvas/background.ts
// Pan (Ctrl+drag), Zoom, cierre de menús y selección por arrastre (marquee).
// Expone bgMode y marquee para feedback visual/cursor.

import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useAppStore } from "../../state/store";
import type { Point } from "../../model/types";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../../layout/measurement";

type CanvasMenuState = { open: boolean; x: number; y: number };
type NodeMenuState = { open: boolean; x: number; y: number; id: number | null };
type ActionMenuState = { open: boolean; x: number; y: number; id: number | null };

type SetCanvasMenu = ( s: CanvasMenuState ) => void;
type SetNodeMenu = ( s: NodeMenuState ) => void;
type SetActionMenu = ( s: ActionMenuState ) => void;

export function useBackgroundInteraction( params: {
    svgRef: RefObject<SVGSVGElement | null>;
    clientToGroupPoint: ( clientX: number, clientY: number ) => Point;

    setCanvasMenu: SetCanvasMenu;
    setNodeMenu: SetNodeMenu;
    setActionMenu: SetActionMenu;
    setAllClosed: () => void;
} ) {
    const { svgRef, clientToGroupPoint, setAllClosed } = params;

    // store
    const setPan = useAppStore( ( s ) => s.setPan );
    const setZoomAnchored = useAppStore( ( s ) => s.setZoomAnchored );
    const clearSelection = useAppStore( ( s ) => s.clearSelection );
    const pending = useAppStore( ( s ) => s.pendingConnect );
    const cancelPending = useAppStore( ( s ) => s.cancelPending );

    // --- Estado UI local para feedback ---
    const [ bgMode, setBgMode ] = useState<"idle" | "panning" | "selecting">( "idle" );
    const [ marquee, setMarquee ] = useState<null | { x: number; y: number; w: number; h: number }>( null );

    // --- PAN (Ctrl+drag) ---
    const draggingPanRef = useRef( false );
    const lastSvgPtRef = useRef<Point>( { x: 0, y: 0 } );

    // --- Selección (drag sin Ctrl) ---
    const selectingRef = useRef( false );
    const selAnchorRef = useRef<Point>( { x: 0, y: 0 } );

    function toSvgPoint( evt: { clientX: number; clientY: number } ): Point {
        const svg = svgRef.current;
        if ( !svg ) return { x: evt.clientX, y: evt.clientY };
        const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
        const ctm = svg.getScreenCTM(); if ( !ctm ) return { x: evt.clientX, y: evt.clientY };
        const inv = ctm.inverse(); const p = pt.matrixTransform( inv ); return { x: p.x, y: p.y };
    }

    function onMouseDownBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        if ( e.button !== 0 ) return;

        // Cerrar menús y limpiar selección (si no hay Shift)
        setAllClosed();
        if ( !e.shiftKey ) clearSelection();

        // Cancelar rubber-banding si existe
        if ( pending ) cancelPending();

        if ( e.ctrlKey || e.metaKey ) {
            // --- PAN ---
            draggingPanRef.current = true;
            const p = toSvgPoint( e ); lastSvgPtRef.current = { x: p.x, y: p.y };
            setBgMode( "panning" );
            e.currentTarget.parentElement?.classList.add( "is-grabbing" );
            e.stopPropagation();
            return;
        }

        // --- SELECCIÓN ---
        selectingRef.current = true;
        const a = clientToGroupPoint( e.clientX, e.clientY );
        selAnchorRef.current = a;
        setMarquee( { x: a.x, y: a.y, w: 0, h: 0 } );
        setBgMode( "selecting" );
        e.stopPropagation();
    }

    function onMouseMoveBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        // PAN activo
        if ( draggingPanRef.current ) {
            const p = toSvgPoint( e );
            const dx = p.x - lastSvgPtRef.current.x;
            const dy = p.y - lastSvgPtRef.current.y;
            if ( dx !== 0 || dy !== 0 ) {
                setPan( dx, dy );
                lastSvgPtRef.current = p;
            }
            return;
        }

        // Selección por arrastre
        if ( selectingRef.current ) {
            const a = selAnchorRef.current;
            const b = clientToGroupPoint( e.clientX, e.clientY );
            const minX = Math.min( a.x, b.x ), maxX = Math.max( a.x, b.x );
            const minY = Math.min( a.y, b.y ), maxY = Math.max( a.y, b.y );

            setMarquee( { x: minX, y: minY, w: maxX - minX, h: maxY - minY } );

            // Selección en vivo
            const s = useAppStore.getState();
            const nextSel = new Set<number>();
            const nextSelActions = new Set<number>();
            const nextSelConds = new Set<number>();

            s.nodes.forEach( n => {
                const m = getNodeSizeCached( n );
                const nx1 = n.x, ny1 = n.y, nx2 = n.x + m.w, ny2 = n.y + m.h;
                const intersects = !( nx2 < minX || nx1 > maxX || ny2 < minY || ny1 > maxY );
                if ( intersects ) nextSel.add( n.id );
            } );

            s.actions.forEach( a1 => {
                const m = measureActionOval( a1.title, a1.wrap ?? 22 );
                const ax1 = a1.x - m.w / 2, ay1 = a1.y - m.h / 2, ax2 = a1.x + m.w / 2, ay2 = a1.y + m.h / 2;
                const intersects = !( ax2 < minX || ax1 > maxX || ay2 < minY || ay1 > maxY );
                if ( intersects ) nextSelActions.add( a1.id );
            } );

            s.conditions.forEach( c1 => {
                const m = measureConditionOval( c1.title, c1.wrap ?? 22 );
                const cx1 = c1.x - m.w / 2, cy1 = c1.y - m.h / 2, cx2 = c1.x + m.w / 2, cy2 = c1.y + m.h / 2;
                const intersects = !( cx2 < minX || cx1 > maxX || cy2 < minY || cy1 > maxY );
                if ( intersects ) nextSelConds.add( c1.id );
            } );

            useAppStore.setState( {
                selection: nextSel,
                selectionActions: nextSelActions,
                selectionConds: nextSelConds,
            } );
        }
    }

    function endPanDrag() {
        if ( draggingPanRef.current ) {
            draggingPanRef.current = false;
            setBgMode( "idle" );
            svgRef.current?.parentElement?.classList.remove( "is-grabbing" );
        }
        if ( selectingRef.current ) {
            selectingRef.current = false;
            setBgMode( "idle" );
            setMarquee( null );
        }
    }

    function onWheel( e: React.WheelEvent<SVGSVGElement> ) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = useAppStore.getState().panzoom.zoom * factor;
        const gp = clientToGroupPoint( e.clientX, e.clientY );
        setZoomAnchored( newZoom, gp );
    }

    return {
        onMouseDownBackground,
        onMouseMoveBackground,
        onWheel,
        endPanDrag,
        bgMode,     // ← para cursor
        marquee,    // ← para dibujar el rect
    };
}
