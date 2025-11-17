// src/components/Canvas/keyboard.ts
// Atajos de teclado a nivel documento para el editor:
// - Delete / Backspace: borrar selección (si existe)
// - Escape: cerrar menús y cancelar rubber-banding pendiente

import { useEffect } from "react";
import { useAppStore } from "../../state/store";
import type {
    CanvasMenuState,
    NodeMenuState,
    ActionMenuState,
} from "./contextmenus";

type SetCanvasMenu = ( s: CanvasMenuState ) => void;
type SetNodeMenu = ( s: NodeMenuState ) => void;
type SetActionMenu = ( s: ActionMenuState ) => void;



export function useKeyboardShortcuts( params: {
    setCanvasMenu: SetCanvasMenu;
    setNodeMenu: SetNodeMenu;
    setActionMenu: SetActionMenu;
} ) {
    const { setCanvasMenu, setNodeMenu, setActionMenu } = params;

    // Acciones del store que usaremos dentro del listener
    const deleteSelected = useAppStore( ( s ) => s.deleteSelected );
    const cancelPending = useAppStore( ( s ) => s.cancelPending );
    const undo = useAppStore( ( s ) => s.undo );
    const redo = useAppStore( ( s ) => s.redo );

    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            function isTypingTarget( t: EventTarget | null ): boolean {
                if ( !t || !( t as any ).closest ) return false;
                const el = t as HTMLElement;
                if ( el.isContentEditable ) return true;
                const tag = el.tagName?.toLowerCase();
                return tag === "input" || tag === "textarea" || tag === "select";
            }


            // Delete / Backspace -> tu lógica actual de borrado
            // Escape -> tu lógica actual
            // dentro de window.addEventListener("keydown", (e) => { ... })
            if ( isTypingTarget( e.target ) ) {
                // No dispares atajos (Backspace/Delete, etc.) si el usuario está escribiendo
                return;
            }

            const state = useAppStore.getState();


            // Ctrl+Z => undo
            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "z" ) {
                e.preventDefault();
                undo();
                return;
            }

            // Ctrl+Shift+Z o Ctrl+Y => redo
            if ( ( e.ctrlKey || e.metaKey ) &&
                ( e.key.toLowerCase() === "y" || ( e.shiftKey && e.key.toLowerCase() === "z" ) ) ) {
                e.preventDefault();
                redo();
                return;
            }

            // Delete / Backspace -> borrar selección si hay algo seleccionado
            if ( e.key === "Delete" || e.key === "Backspace" ) {
                const hasSel =
                    state.selection.size > 0 ||
                    state.selectionActions.size > 0 ||
                    state.selectionConds.size > 0;

                if ( hasSel ) {
                    e.preventDefault();
                    deleteSelected();
                    // opcional: cerrar menús si había alguno abierto
                    setCanvasMenu( { open: false, x: 0, y: 0 } );
                    setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                    setActionMenu( { open: false, x: 0, y: 0, id: null } );
                    return;
                }
            }

            // Escape -> cerrar menús y cancelar rubber-banding
            if ( e.key === "Escape" ) {
                e.preventDefault();
                setCanvasMenu( { open: false, x: 0, y: 0 } );
                setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                setActionMenu( { open: false, x: 0, y: 0, id: null } );

                if ( state.pendingConnect ) {
                    cancelPending();
                }
            }
        }

        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ deleteSelected, cancelPending, setCanvasMenu, setNodeMenu, setActionMenu ] );
}
