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
    ConditionMenuState,
} from "./contextmenus";

type SetCanvasMenu = ( s: CanvasMenuState ) => void;
type SetNodeMenu = ( s: NodeMenuState ) => void;
type SetActionMenu = ( s: ActionMenuState ) => void;
type SetConditionMenu = ( s: ConditionMenuState ) => void;

// ---- Helpers de tipado DOM (sin any) ----
function isElement( t: EventTarget | null ): t is Element {
    return typeof Element !== "undefined" && t instanceof Element;
}
function isHTMLElement( el: Element ): el is HTMLElement {
    return typeof HTMLElement !== "undefined" && el instanceof HTMLElement;
}
function isTypingTarget( t: EventTarget | null ): boolean {
    if ( !isElement( t ) ) return false;
    if ( isHTMLElement( t ) && t.isContentEditable ) return true;
    const tag = t.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
}

export function useKeyboardShortcuts( params: {
    setCanvasMenu: SetCanvasMenu;
    setNodeMenu: SetNodeMenu;
    setActionMenu: SetActionMenu;
    setConditionMenu: SetConditionMenu;
} ) {
    const { setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu } = params;

    // Acciones del store que usaremos dentro del listener
    const deleteSelected = useAppStore( ( s ) => s.deleteSelected );
    const cancelPending = useAppStore( ( s ) => s.cancelPending );
    const undo = useAppStore( ( s ) => s.undo );
    const redo = useAppStore( ( s ) => s.redo );
    const copySel = useAppStore( ( s ) => s.copySelectionToClipboard );
    const pasteSel = useAppStore( ( s ) => s.pasteFromClipboard );

    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            // No dispares atajos si el usuario está escribiendo
            if ( isTypingTarget( e.target ) ) return;

            const state = useAppStore.getState();

            // Ctrl+Z => undo
            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "z" ) {
                e.preventDefault();
                undo();
                return;
            }

            // Ctrl+Shift+Z o Ctrl+Y => redo
            if (
                ( e.ctrlKey || e.metaKey ) &&
                ( e.key.toLowerCase() === "y" || ( e.shiftKey && e.key.toLowerCase() === "z" ) )
            ) {
                e.preventDefault();
                redo();
                return;
            }

            // Ctrl/Cmd+C => copy
            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "c" ) {
                e.preventDefault();
                copySel();
                return;
            }

            // Ctrl/Cmd+X => cut
            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "x" ) {
                e.preventDefault();
                useAppStore.getState().cutSelectionToClipboard?.();
                return;
            }

            // Ctrl/Cmd+V => paste (al centro visible)
            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "v" ) {
                e.preventDefault();
                pasteSel();
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
                    setConditionMenu( { open: false, x: 0, y: 0, id: null } );
                    return;
                }
            }

            // Escape -> cerrar menús y cancelar rubber-banding
            if ( e.key === "Escape" ) {
                e.preventDefault();
                setCanvasMenu( { open: false, x: 0, y: 0 } );
                setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                setActionMenu( { open: false, x: 0, y: 0, id: null } );
                setConditionMenu( { open: false, x: 0, y: 0, id: null } );

                if ( state.pendingConnect ) {
                    cancelPending();
                }
            }
        }

        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ deleteSelected, cancelPending, setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu, undo, redo, copySel, pasteSel ] );
}
