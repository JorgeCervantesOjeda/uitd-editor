// src/components/Canvas/TopToolbar/menus/ExportMenu.tsx
// Renders canvas export actions that are independent from UITDL text authoring.

import React from "react";
import { ExportToolbar } from "../../ExportToolbar";

export function ExportMenu( { svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> } ) {
    return (
        <div style={ { padding: 4, display: "grid", gap: 6, minWidth: 110 } }>
            <ExportToolbar svgRef={ svgRef } />
        </div>
    );
}
