// src/components/Canvas/dragging.ts
// Manejo de movimiento combinado sobre el <svg>:
// - Actualiza rubber-banding (pendingConnect → mouse).
// - Actualiza drag combinado (nodos/acciones/condiciones).
// - Realiza PAN si está activo (cuando el parent del <svg> tiene la clase "is-grabbing").
//
// Nota: El PAN inicia/termina en background.ts (onMouseDownBackground / endPanDrag),
// aquí solo movemos mientras el mouse se desplaza.

import { useRef } from "react";
import { useAppStore } from "../../state/store";
import type { Point } from "../../model/types";

export function useCombinedDragging( params: {
    clientToGroupPoint: ( clientX: number, clientY: number ) => Point;
} ) {
    const { clientToGroupPoint } = params;

    // Store selectors
    const drag = () => useAppStore.getState().drag;
    const updateCombinedDrag = useAppStore( ( s ) => s.updateCombinedDrag );
    const updatePendingMouse = useAppStore( ( s ) => s.updatePendingMouse );
    const pending = () => useAppStore.getState().pendingConnect;

    // Para PAN en movimiento (en coords del <svg>)
    const setPan = useAppStore( ( s ) => s.setPan );
    const lastSvgPtRef = useRef<Point>( { x: 0, y: 0 } );
    const panActiveRef = useRef( false );

    // Utilidad local: convertir (clientX, clientY) a coords del <svg>,
    // usando la CTM del propio elemento <svg>.
    function toSvgPointFromEvent( e: React.MouseEvent<SVGSVGElement, MouseEvent> ): Point {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        const ctm = svg.getScreenCTM();
        if ( !ctm ) return { x: e.clientX, y: e.clientY };

        const inv = ctm.inverse();
        const p = pt.matrixTransform( inv );
        return { x: p.x, y: p.y };
    }

    function onMouseMoveCombined( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        // 1) Rubber-banding: siempre actualizamos si existe pendingConnect.
        const p = pending();
        if ( p ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updatePendingMouse( gp );
        }

        // 2) Drag combinado de entidades
        const d = drag();
        if ( d.active ) {
            const gp = clientToGroupPoint( e.clientX, e.clientY );
            updateCombinedDrag( gp );
            return;
        }

        // 3) PAN en movimiento: si el <div> contenedor tiene "is-grabbing" (lo pone background.ts)
        const isGrabbing = e.currentTarget.parentElement?.classList.contains( "is-grabbing" ) ?? false;

        if ( isGrabbing ) {
            const pSvg = toSvgPointFromEvent( e );

            if ( !panActiveRef.current ) {
                // Primera muestra mientras está activo el pan
                panActiveRef.current = true;
                lastSvgPtRef.current = pSvg;
                return;
            }

            const dx = pSvg.x - lastSvgPtRef.current.x;
            const dy = pSvg.y - lastSvgPtRef.current.y;
            if ( dx !== 0 || dy !== 0 ) {
                setPan( dx, dy );
                lastSvgPtRef.current = pSvg;
            }
        } else {
            // Si no hay pan activo, reseteamos la bandera local
            panActiveRef.current = false;
        }
    }

    function endCombined() {
        // Terminar drag combinado (si lo hay). El fin de PAN lo maneja background.ts (endPanDrag).
        const d = drag();
        if ( d.active ) {
            useAppStore.getState().endCombinedDrag();
        }
        // No tocar pendingConnect aquí; Escape o commit lo administran.
    }

    return { onMouseMoveCombined, endCombined };
}
