import React from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";

export function DistributeMenu() {
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canDistribute = selNodeCount + selActsCount + selCondsCount >= 3;

    const distributeH = useAppStore( ( s ) => s.distributeSelectedHorizontally );
    const distributeV = useAppStore( ( s ) => s.distributeSelectedVertically );

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <button
                role="menuitem"
                disabled={ !canDistribute }
                onClick={ () => canDistribute && distributeH() }
                title="Distribute horizontally"
                style={ menuItem }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6v12M20 6v12" />
                    <rect x="7" y="8" width="3" height="8" />
                    <rect x="14" y="8" width="3" height="8" />
                </svg>
                Horizontal (centers)
            </button>
            <button
                role="menuitem"
                disabled={ !canDistribute }
                onClick={ () => canDistribute && distributeV() }
                title="Distribute vertically"
                style={ menuItem }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 4h12M6 20h12" />
                    <rect x="8" y="7" width="8" height="3" />
                    <rect x="8" y="14" width="8" height="3" />
                </svg>
                Vertical (centers)
            </button>
        </div>
    );
}
