import React from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";

export function AlignMenu() {
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canAlign = selNodeCount + selActsCount + selCondsCount >= 2;

    const alignLeft = useAppStore( ( s ) => s.alignLeft );
    const alignCenterX = useAppStore( ( s ) => s.alignCenterX );
    const alignRight = useAppStore( ( s ) => s.alignRight );
    const alignTop = useAppStore( ( s ) => s.alignTop );
    const alignMiddleY = useAppStore( ( s ) => s.alignMiddleY );
    const alignBottom = useAppStore( ( s ) => s.alignBottom );

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignLeft() }
                title="Align to the left (edges)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6v12" /><rect x="5" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                </svg>
                Left
            </button>
            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignCenterX() }
                title="Center horizontally (centers X)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 6v12" /><rect x="7" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                </svg>
                Center horizontally
            </button>
            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignRight() }
                title="Align to the right (edges)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 6v12" /><rect x="9" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                </svg>
                Right
            </button>

            <hr style={ { border: 0, borderTop: "1px solid #e5e7eb", margin: "6px 0" } } />

            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignTop() }
                title="Align to the top (edges)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 3h12" /><rect x="7" y="5" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                </svg>
                Top
            </button>
            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignMiddleY() }
                title="Center vertically (centers Y)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 12h12" /><rect x="7" y="7" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                </svg>
                Center vertically
            </button>
            <button role="menuitem" disabled={ !canAlign } onClick={ () => canAlign && alignBottom() }
                title="Align to the bottom (edges)" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 21h12" /><rect x="7" y="9" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                </svg>
                Bottom
            </button>
        </div>
    );
}
