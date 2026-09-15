// src/components/Canvas/contextmenus.ts
// Estado local para menús contextuales + helper para crear nodo desde el menú del canvas.

import { useCallback, useState } from "react";
import { useAppStore } from "../../state/store";

export type CanvasMenuState = { open: boolean; x: number; y: number };
export type NodeMenuState = { open: boolean; x: number; y: number; id: number | null };
export type ActionMenuState = { open: boolean; x: number; y: number; id: number | null };
export type ConditionMenuState = { open: boolean; x: number; y: number; id: number | null };

export function useContextMenus( isCanvasLocked: boolean ) {
    const [ canvasMenu, setCanvasMenu ] = useState<CanvasMenuState>( { open: false, x: 0, y: 0 } );
    const [ nodeMenu, setNodeMenu ] = useState<NodeMenuState>( { open: false, x: 0, y: 0, id: null } );
    const [ actionMenu, setActionMenu ] = useState<ActionMenuState>( { open: false, x: 0, y: 0, id: null } );
    const [ conditionMenu, setConditionMenu ] = useState<ConditionMenuState>( { open: false, x: 0, y: 0, id: null } );

    const createNodeAt = useAppStore( s => s.createNodeAt );

    const setAllClosed = useCallback( () => {
        setCanvasMenu( { open: false, x: 0, y: 0 } );
        setNodeMenu( { open: false, x: 0, y: 0, id: null } );
        setActionMenu( { open: false, x: 0, y: 0, id: null } );
        setConditionMenu( { open: false, x: 0, y: 0, id: null } );
    }, [] );

    function onContextMenuHost( e: React.MouseEvent ) {
        e.preventDefault();
        if ( isCanvasLocked ) {
            setAllClosed();
            return;
        }
        setNodeMenu( { open: false, x: 0, y: 0, id: null } );
        setActionMenu( { open: false, x: 0, y: 0, id: null } );
        setConditionMenu( { open: false, x: 0, y: 0, id: null } );
        setCanvasMenu( { open: true, x: e.clientX, y: e.clientY } );
    }

    /**
     * Crea un nodo nuevo centrado bajo el cursor (coordenadas de pantalla),
     * usando client→group para convertir a coordenadas del <g data-root>.
     */
    function createNodeFromCanvasMenu(
        screenX: number,
        screenY: number,
        clientToGroupPoint: ( x: number, y: number ) => { x: number; y: number }
    ) {
        if ( isCanvasLocked ) {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            return;
        }
        const world = clientToGroupPoint( screenX, screenY );
        createNodeAt( world.x, world.y );
        setCanvasMenu( { open: false, x: 0, y: 0 } );
    }

    return {
        canvasMenu, nodeMenu, actionMenu, conditionMenu,
        setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu,
        setAllClosed, onContextMenuHost,
        createNodeFromCanvasMenu,
    };
}
