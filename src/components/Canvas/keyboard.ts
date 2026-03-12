// src/components/Canvas/keyboard.ts
// Atajos de teclado a nivel documento para el editor:
// - Delete / Backspace: borrar seleccion (si existe) cuando el foco esta en el diagrama
// - Escape: cerrar menus y cancelar rubber-banding pendiente

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

function isDiagramKeyboardTarget( t: EventTarget | null ): boolean {
    if ( !isElement( t ) ) return false;
    return !!t.closest( `[data-diagram-surface="true"], [data-kbd-kind]` );
}

export function useKeyboardShortcuts( params: {
    setCanvasMenu: SetCanvasMenu;
    setNodeMenu: SetNodeMenu;
    setActionMenu: SetActionMenu;
    setConditionMenu: SetConditionMenu;
    dialogsOpen: boolean;
} ) {
    const { setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu, dialogsOpen } = params;

    const deleteSelected = useAppStore( ( s ) => s.deleteSelected );
    const cancelPending = useAppStore( ( s ) => s.cancelPending );
    const undo = useAppStore( ( s ) => s.undo );
    const redo = useAppStore( ( s ) => s.redo );
    const copySel = useAppStore( ( s ) => s.copySelectionToClipboard );
    const pasteSel = useAppStore( ( s ) => s.pasteFromClipboard );
    const cancelSelectionMarquee = useAppStore( ( s ) => s.cancelSelectionMarquee );

    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            if ( isTypingTarget( e.target ) ) return;
            if ( dialogsOpen ) return;

            const state = useAppStore.getState();

            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "z" ) {
                e.preventDefault();
                undo();
                return;
            }

            if (
                ( e.ctrlKey || e.metaKey ) &&
                ( e.key.toLowerCase() === "y" || ( e.shiftKey && e.key.toLowerCase() === "z" ) )
            ) {
                e.preventDefault();
                redo();
                return;
            }

            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "c" ) {
                e.preventDefault();
                copySel();
                return;
            }

            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "x" ) {
                e.preventDefault();
                useAppStore.getState().cutSelectionToClipboard?.();
                return;
            }

            if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key.toLowerCase() === "v" ) {
                e.preventDefault();
                pasteSel();
                return;
            }

            if ( e.key === "Delete" || e.key === "Backspace" ) {
                const hasSel =
                    state.selection.size > 0 ||
                    state.selectionActions.size > 0 ||
                    state.selectionConds.size > 0;

                if ( hasSel && isDiagramKeyboardTarget( e.target ) ) {
                    e.preventDefault();
                    deleteSelected();
                    setCanvasMenu( { open: false, x: 0, y: 0 } );
                    setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                    setActionMenu( { open: false, x: 0, y: 0, id: null } );
                    setConditionMenu( { open: false, x: 0, y: 0, id: null } );
                    return;
                }
            }

            if ( e.key === "Escape" ) {
                e.preventDefault();
                setCanvasMenu( { open: false, x: 0, y: 0 } );
                setNodeMenu( { open: false, x: 0, y: 0, id: null } );
                setActionMenu( { open: false, x: 0, y: 0, id: null } );
                setConditionMenu( { open: false, x: 0, y: 0, id: null } );
                cancelSelectionMarquee();

                if ( state.pendingConnect ) {
                    cancelPending();
                }
            }
        }

        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ cancelSelectionMarquee, deleteSelected, cancelPending, copySel, dialogsOpen, pasteSel, redo, setActionMenu, setCanvasMenu, setConditionMenu, setNodeMenu, undo ] );
}
