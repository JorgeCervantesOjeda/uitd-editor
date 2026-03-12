// src/components/Canvas/background.ts
// Pan (Ctrl+drag), Zoom, cierre de menus y seleccion por arrastre (marquee).
// Expone bgMode y marquee para feedback visual/cursor.

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useAppStore } from "../../state/store";
import type { Point } from "../../model/types";
import { computeSelectionIntersectingRect, getFirstTargetInSelection } from "../../state/selectionRect";

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

    const setPan = useAppStore( ( s ) => s.setPan );
    const setZoomAnchored = useAppStore( ( s ) => s.setZoomAnchored );
    const pending = useAppStore( ( s ) => s.pendingConnect );
    const cancelPending = useAppStore( ( s ) => s.cancelPending );
    const beginSelectionMarquee = useAppStore( ( s ) => s.beginSelectionMarquee );
    const cancelSelectionMarquee = useAppStore( ( s ) => s.cancelSelectionMarquee );

    const [ bgMode, setBgMode ] = useState<"idle" | "panning" | "selecting">( "idle" );
    const [ marquee, setMarquee ] = useState<null | { x: number; y: number; w: number; h: number }>( null );

    const draggingPanRef = useRef( false );
    const lastSvgPtRef = useRef<Point>( { x: 0, y: 0 } );

    const selectingRef = useRef( false );
    const selAnchorRef = useRef<Point>( { x: 0, y: 0 } );

    useEffect( () => {
        function onKeyDown( e: KeyboardEvent ) {
            if ( e.key !== "Escape" ) return;
            if ( !selectingRef.current ) return;
            selectingRef.current = false;
            setBgMode( "idle" );
            setMarquee( null );
            cancelSelectionMarquee();
        }

        document.addEventListener( "keydown", onKeyDown, true );
        return () => document.removeEventListener( "keydown", onKeyDown, true );
    }, [ cancelSelectionMarquee ] );

    function toSvgPoint( evt: { clientX: number; clientY: number } ): Point {
        const svg = svgRef.current;
        if ( !svg ) return { x: evt.clientX, y: evt.clientY };
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = svg.getScreenCTM();
        if ( !ctm ) return { x: evt.clientX, y: evt.clientY };
        const inv = ctm.inverse();
        const p = pt.matrixTransform( inv );
        return { x: p.x, y: p.y };
    }

    function onMouseDownBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        const isLeft = e.button === 0;
        const isMiddle = e.button === 1;
        const isRight = e.button === 2;

        setAllClosed();

        if ( pending ) {
            if ( isRight ) cancelPending();
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        if ( isMiddle ) {
            e.preventDefault();
            draggingPanRef.current = true;
            const p = toSvgPoint( e );
            lastSvgPtRef.current = { x: p.x, y: p.y };
            setBgMode( "panning" );
            svgRef.current?.parentElement?.classList.add( "is-grabbing" );
            e.stopPropagation();
            return;
        }

        if ( isLeft && ( e.ctrlKey || e.metaKey ) ) {
            e.preventDefault();
            draggingPanRef.current = true;
            const p = toSvgPoint( e );
            lastSvgPtRef.current = { x: p.x, y: p.y };
            setBgMode( "panning" );
            svgRef.current?.parentElement?.classList.add( "is-grabbing" );
            e.stopPropagation();
            return;
        }

        if ( isRight ) return;

        if ( isLeft ) {
            beginSelectionMarquee();
            if ( !e.shiftKey ) {
                useAppStore.setState( {
                    selection: new Set<number>(),
                    selectionActions: new Set<number>(),
                    selectionConds: new Set<number>(),
                    keyboardMarquee: null,
                    marqueeSeed: null,
                } );
            }

            const a = clientToGroupPoint( e.clientX, e.clientY );
            selAnchorRef.current = a;
            setMarquee( { x: a.x, y: a.y, w: 0, h: 0 } );
            setBgMode( "selecting" );
            selectingRef.current = true;
            e.stopPropagation();
        }
    }

    function onMouseMoveBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
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

        if ( selectingRef.current ) {
            const a = selAnchorRef.current;
            const b = clientToGroupPoint( e.clientX, e.clientY );
            const minX = Math.min( a.x, b.x );
            const maxX = Math.max( a.x, b.x );
            const minY = Math.min( a.y, b.y );
            const maxY = Math.max( a.y, b.y );

            setMarquee( { x: minX, y: minY, w: maxX - minX, h: maxY - minY } );

            const s = useAppStore.getState();
            const selection = computeSelectionIntersectingRect( s.nodes, s.actions, s.conditions, {
                x: minX,
                y: minY,
                w: maxX - minX,
                h: maxY - minY,
            } );
            const marqueeSeed = s.marqueeSeed ?? getFirstTargetInSelection(
                s.nodes,
                s.actions,
                s.conditions,
                selection.selection,
                selection.selectionActions,
                selection.selectionConds,
            );

            useAppStore.setState( {
                selection: selection.selection,
                selectionActions: selection.selectionActions,
                selectionConds: selection.selectionConds,
                marqueeSeed,
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
        bgMode,
        marquee,
    };
}
