import React from "react";
import type { RefObject } from "react";
import { FileToolbar } from "./FileToolbar";
import { HelpPanel } from "./HelpPanel";
import { ExportToolbar } from "./ExportToolbar";
import { WarningsPanel } from "./WarningsPanel";
import { useAppStore } from "../../state/store";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {

    const recolorAllNodesRandomly = useAppStore( s => ( s as any ).recolorAllNodesRandomly );

    return (
        <div
            style={ {
                position: "fixed",
                top: 8,
                left: 8,
                right: 8,
                zIndex: 70,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",      // se acomoda en dos filas si no cabe
                pointerEvents: "none", // la barra no bloquea; cada control activa 'auto'
            } }
        >
            <div style={ { pointerEvents: "auto" } }>
                <HelpPanel />
            </div>

            <div style={ { pointerEvents: "auto" } }>
                <FileToolbar />
            </div>

            <div style={ { pointerEvents: "auto" } }>
                <ExportToolbar svgRef={ svgRef } />
            </div>

            {/* ⬇️ Botón Recolorear (no bloquea ni estilos externos) */ }
            <div style={ { pointerEvents: "auto" } }>
                <button
                    type="button"
                    onClick={ () => recolorAllNodesRandomly?.() }
                    style={ {
                        padding: "6px 10px",
                        fontSize: 14,
                        borderRadius: 6,
                        border: "1px solid #94a3b8",
                        background: "#f8fafc",
                        color: "#0f172a",
                        cursor: "pointer",
                    } }
                    title="Recolorear nodos por displayId (aleatorio)"
                >
                    Recolor Nodes
                </button>
            </div>

            <div style={ { flex: 1 } } />

            <div style={ { pointerEvents: "auto" } }>
                <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } />
            </div>
        </div>
    );
}
