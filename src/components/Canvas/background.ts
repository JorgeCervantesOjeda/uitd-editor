// src/components/Canvas/background.ts
// Manejo de interacciones sobre el fondo del SVG:
// - Pan con arrastre del mouse (botón izquierdo)
// - Zoom con rueda (anclado al puntero)
// - Cierre de menús y cancelación de rubber-banding al iniciar pan

import { useRef } from "react";
import type { RefObject } from "react";
import { useAppStore } from "../../state/store";
import type { Point } from "../../model/types";

// Estados de menú que se reciben desde useContextMenus()
type CanvasMenuState = { open: boolean; x: number; y: number };
type NodeMenuState = { open: boolean; x: number; y: number; id: number | null };
type ActionMenuState = { open: boolean; x: number; y: number; id: number | null };

type SetCanvasMenu = ( s: CanvasMenuState ) => void;
type SetNodeMenu = ( s: NodeMenuState ) => void;
type SetActionMenu = ( s: ActionMenuState ) => void;

export function useBackgroundInteraction( params: {
    svgRef: RefObject<SVGSVGElement | null>;
    clientToGroupPoint: ( clientX: number, clientY: number ) => Point;

    // setters de menús para cerrarlos al iniciar pan
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

    // refs para pan
    const draggingPanRef = useRef( false );
    const lastSvgPtRef = useRef<Point>( { x: 0, y: 0 } );

    // Utilidad local: (clientX, clientY) -> punto en coords del <svg>
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
        if ( e.button !== 0 ) return;

        // Inicia pan
        draggingPanRef.current = true;
        const p = toSvgPoint( e );
        lastSvgPtRef.current = { x: p.x, y: p.y };

        // Cursor de "grabbing"
        svgRef.current?.parentElement?.classList.add( "is-grabbing" );

        // Cierra menús y limpia selección si no se mantiene con Shift
        setAllClosed();
        if ( !e.shiftKey ) clearSelection();

        // Si hay rubber-banding pendiente, cancelarlo
        if ( pending ) cancelPending();

        // Captura eventos posteriores
        // (no imprescindible, pero ayuda a que no se dispare selección accidental)
        e.stopPropagation();
    }

    // Nota: el movimiento de pan se realiza desde onMouseMoveCombined (dragging.ts),
    // que decide si hay drag combinado de entidades o pan de fondo.
    // Aun así, dejamos esta función por si quieres usarla directamente.
    function onMouseMoveBackground( e: React.MouseEvent<SVGSVGElement, MouseEvent> ) {
        if ( !draggingPanRef.current ) return;
        const p = toSvgPoint( e );
        const dx = p.x - lastSvgPtRef.current.x;
        const dy = p.y - lastSvgPtRef.current.y;
        if ( dx !== 0 || dy !== 0 ) {
            setPan( dx, dy );
            lastSvgPtRef.current = p;
        }
    }

    function endPanDrag() {
        if ( !draggingPanRef.current ) return;
        draggingPanRef.current = false;
        svgRef.current?.parentElement?.classList.remove( "is-grabbing" );
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
        onWheel,
        endPanDrag,
        // expuesto por si más adelante deseas conectarlo directamente
        onMouseMoveBackground,
    };
}
