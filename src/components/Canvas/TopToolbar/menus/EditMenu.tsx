import React from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";

export function EditMenu() {
    const canUndo = useAppStore( ( s ) => s.historyUndo.length > 0 );
    const canRedo = useAppStore( ( s ) => s.historyRedo.length > 0 );
    const undo = useAppStore( ( s ) => s.undo );
    const redo = useAppStore( ( s ) => s.redo );
    const isCanvasLocked = useAppStore( ( s ) => s.isCanvasLockedByUITDLLiveSync );

    return (
        <div style={ { display: "grid", gap: 4, width: 170 } }>
            {/* Undo */ }
            <button
                role="menuitem"
                disabled={ isCanvasLocked || !canUndo }
                onClick={ () => !isCanvasLocked && canUndo && undo() }
                title={ isCanvasLocked ? "Turn off Live to canvas to undo canvas changes" : "Undo (Ctrl+Z)" }
                style={ menuItem }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20a9 9 0 0 0-9-9H4" />
                </svg>
                Undo
            </button>

            {/* Redo */ }
            <button
                role="menuitem"
                disabled={ isCanvasLocked || !canRedo }
                onClick={ () => !isCanvasLocked && canRedo && redo() }
                title={ isCanvasLocked ? "Turn off Live to canvas to redo canvas changes" : "Redo (Ctrl+Shift+Z / Ctrl+Y)" }
                style={ menuItem }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 4 20 9 15 14" />
                    <path d="M4 20a9 9 0 0 1 9-9h7" />
                </svg>
                Redo
            </button>
        </div>
    );
}
