import React from "react";
import type { RefObject } from "react";
import { FileToolbar } from "./FileToolbar";
import { HelpPanel } from "./HelpPanel";
import { ExportToolbar } from "./ExportToolbar";
import { WarningsPanel } from "./WarningsPanel";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
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

            <div style={ { flex: 1 } } />

            <div style={ { pointerEvents: "auto" } }>
                <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } />
            </div>
        </div>
    );
}
