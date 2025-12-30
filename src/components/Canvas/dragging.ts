// src/components/Canvas/dragging.ts
import { useAppStore } from "../../state/store";

export function useCombinedDragging( params: {
    clientToGroupPoint: ( clientX: number, clientY: number ) => { x: number, y: number };
} ) {
    const { clientToGroupPoint } = params;

    const drag = () => useAppStore.getState().drag;
    const updateCombinedDrag = useAppStore( ( s ) => s.updateCombinedDrag );
    const updatePendingMouse = useAppStore( ( s ) => s.updatePendingMouse );
    const pending = () => useAppStore.getState().pendingConnect;

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
