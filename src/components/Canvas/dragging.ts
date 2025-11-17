// src/components/Canvas/dragging.ts
import { useRef } from "react";
import { useAppStore } from "../../state/store";
import type { Point } from "../../model/types";

export function useCombinedDragging( params: {
    clientToGroupPoint: ( clientX: number, clientY: number ) => Point;
} ) {
    const { clientToGroupPoint } = params;

    const drag = () => useAppStore.getState().drag;
    const updateCombinedDrag = useAppStore( ( s ) => s.updateCombinedDrag );
    const updatePendingMouse = useAppStore( ( s ) => s.updatePendingMouse );
    const pending = () => useAppStore.getState().pendingConnect;

    const setPan = useAppStore( ( s ) => s.setPan );
    const lastSvgPtRef = useRef<Point>( { x: 0, y: 0 } );
    const panActiveRef = useRef( false );

    function toSvgPointFromEvent( e: React.MouseEvent<SVGSVGElement, MouseEvent> ): Point {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const ctm = svg.getScreenCTM(); if ( !ctm ) return { x: e.clientX, y: e.clientY };
        const inv = ctm.inverse(); const p = pt.matrixTransform( inv ); return { x: p.x, y: p.y };
    }

    function onMouseMoveCombined( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        const p = pending();
        if ( p ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updatePendingMouse( gp );
        }

        const d = drag();
        if ( d.active ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updateCombinedDrag( gp );

            // Hover de drop target si hay un solo nodo seleccionado
            const sel = useAppStore.getState().selection;
            if ( sel.size === 1 ) {
                const nodeId = Array.from( sel )[ 0 ];
                const target = useAppStore.getState().getDropTargetFor( nodeId );
                useAppStore.getState().setDragHoverParent( target );
            } else {
                useAppStore.getState().setDragHoverParent( null );
            }
            return;
        }

        const isGrabbing = e.currentTarget.parentElement?.classList.contains( "is-grabbing" ) ?? false;
        if ( isGrabbing ) {
            const pSvg = toSvgPointFromEvent( e );
            if ( !panActiveRef.current ) { panActiveRef.current = true; lastSvgPtRef.current = pSvg; return; }
            const dx = pSvg.x - lastSvgPtRef.current.x;
            const dy = pSvg.y - lastSvgPtRef.current.y;
            if ( dx !== 0 || dy !== 0 ) { setPan( dx, dy ); lastSvgPtRef.current = pSvg; }
        } else {
            panActiveRef.current = false;
        }
    }

    function endCombined() {
        const d = drag();
        if ( d.active ) useAppStore.getState().endCombinedDrag();
        // Limpieza del hover se hace en endCombinedDrag; redundancia defensiva:
        useAppStore.getState().setDragHoverParent( null );
    }

    return { onMouseMoveCombined, endCombined };
}
