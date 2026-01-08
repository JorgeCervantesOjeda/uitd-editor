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
            updateCombinedDrag( gp, e.shiftKey );
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
