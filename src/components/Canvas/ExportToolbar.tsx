import React from "react";
import { exportJpg, exportSvg } from "../../utils/exportsvg";

type Props = {
    svgRef: React.RefObject<SVGSVGElement | null>;
};

export default function ExportToolbar( { svgRef }: Props ) {
    const onExportSvg = () => {
        const el = svgRef.current;
        if ( !el ) return;
        exportSvg( el, "diagram.svg" );
    };

    const onExportJpg = () => {
        const el = svgRef.current;
        if ( !el ) return;
        exportJpg( el, "diagram.jpg", { scale: 2, quality: 0.92, background: "#ffffff" } );
    };

    return (
        <div style={ { position: "absolute", top: 12, left: 320, zIndex: 70, display: "flex", gap: 8, pointerEvents: "auto" } }>
            <button onClick={ onExportSvg } title="Download as SVG" style={ { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer" } }>
                Export SVG
            </button>
            <button onClick={ onExportJpg } title="Download as JPG" style={ { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", cursor: "pointer" } }>
                Export JPG
            </button>
        </div>
    );
}
