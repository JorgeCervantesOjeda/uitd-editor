import React from "react";
import { menuItem } from "../styles";
import { ExportToolbar } from "../../ExportToolbar";
import { UITDLIcon } from "../icons";
import { useAppStore } from "../../../../state/store";

import { exportToUITDL } from "../../../../export/uitdl"; // AJUSTA LA RUTA

export function ExportMenu( { svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> } ) {
    const exportUITDL = () => {
        const s = useAppStore.getState();

        // AppState completo (o al menos {nodes, actions, conditions, edges} que usa exportToUITDL)
        const utdl = exportToUITDL(
            {
                nodes: s.nodes,
                actions: s.actions,
                conditions: s.conditions,
                edges: s.edges,
            } as any,
            { title: "UITD Diagram" }
        );

        const blob = new Blob( [ utdl ], { type: "text/plain;charset=utf-8" } );
        const a = document.createElement( "a" );
        const url = URL.createObjectURL( blob );
        a.href = url;
        a.download = "diagram.uitd"; // o ".uitdl.txt" según tu tooling
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
