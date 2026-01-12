import React from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";

export function UtilsMenu() {
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const selAny = selNodeCount + selActsCount + selCondsCount > 0;

    const recolorSelection = () => useAppStore.getState().recolorSelectionRandomly?.();
    const recolorAll = () => useAppStore.getState().recolorAllNodesRandomly?.();
    const clearAll = () => {
        const s = useAppStore.getState();
        s.resetProjectToBlank?.();
        s.clearSavedProject?.();
    };

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <button
                role="menuitem"
                disabled={ !selAny }
                onClick={ () => selAny && recolorSelection() }
                title={ selAny ? "Recolor selected nodes by displayId" : "Select items first" }
                style={ { ...menuItem, ...( !selAny ? { opacity: 0.6 } : {} ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1a2 2 0 0 0-2 2v1c0 1.8-1.2 3-3 3z" />
                    <circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" />
                    <circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
                </svg>
                Recolor selection by displayId
            </button>

            <button role="menuitem" onClick={ recolorAll } title="Recolor all nodes by displayId" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3h18v18H3z" />
                    <path d="M3 12h18" />
                    <path d="M12 3v18" />
                </svg>
                Recolor ALL (global)
            </button>

            <button role="menuitem" onClick={ clearAll } title="Delete all the diagram" style={ { ...menuItem, color: "#b91c1c" } }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete all the diagram
            </button>
        </div>
    );
}
