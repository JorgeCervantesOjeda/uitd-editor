import React from "react";
import { menuItem } from "../styles";
import { ExportToolbar } from "../../ExportToolbar";
import { UITDLIcon } from "../icons";
import { useAppStore } from "../../../../state/store";

export function ExportMenu( { svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> } ) {
    const exportUITDL = () => {
        const s = useAppStore.getState();
        const payload = {
            nodes: s.nodes,
            actions: s.actions,
            conditions: s.conditions,
            edges: s.edges,
            panzoom: s.panzoom,
            viewBox: s.viewBox,
        };
        const json = JSON.stringify( payload, null, 2 );
        const blob = new Blob( [ json ], { type: "application/json" } );
        const a = document.createElement( "a" );
        const url = URL.createObjectURL( blob );
        a.href = url;
        a.download = "diagram.uitdl.json";
        document.body.appendChild( a );
        a.click();
        document.body.removeChild( a );
        URL.revokeObjectURL( url );
    };

    return (
        <div style={ { padding: 4, display: "grid", gap: 6, minWidth: 110 } }>
            <ExportToolbar svgRef={ svgRef } />
            <button
                type="button"
                onClick={ exportUITDL }
                title="Export UITDL"
                style={ { ...menuItem, justifyContent: "flex-start" } }
            >
                <UITDLIcon />
                <span style={ { fontWeight: 700, letterSpacing: 0.5, marginLeft: 4 } }>UITDL</span>
            </button>
        </div>
    );
}
