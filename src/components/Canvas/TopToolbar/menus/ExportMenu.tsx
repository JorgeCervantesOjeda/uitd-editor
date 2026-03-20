import React from "react";
import { menuItem } from "../styles";
import { ExportToolbar } from "../../ExportToolbar";
import { UITDLIcon } from "../icons";
import { useAppStore } from "../../../../state/store";

import { exportToUITDL } from "../../../../export/uitdl";
import { validateWithOfficialValidator } from "../../../../import/uitdl/officialValidator";
import type { ParseIssue } from "../../../../import/uitdl/types";

function formatIssuesForPopup( issues: ParseIssue[] ) {
    const lines: string[] = [];
    const max = 12;

    for ( let i = 0; i < Math.min( max, issues.length ); i++ ) {
        const it = issues[ i ];
        const loc =
            ( it.line != null && it.col != null )
                ? `L${it.line}:C${it.col}`
                : "";
        const tag = it.kind ? String( it.kind ).toUpperCase() : "ISSUE";
        const prefix = [ tag, loc ].filter( Boolean ).join( " " );

        lines.push( `${prefix}: ${it.message}` );
    }

    if ( issues.length > max ) {
        lines.push( `... (${issues.length - max} más)` );
    }

    return lines.join( "\n" );
}

export function ExportMenu( { svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> } ) {
    const exportUITDL = () => {
        const s = useAppStore.getState();

        const uitd = exportToUITDL( s, { title: "UITD Diagram" } );
        const issues = validateWithOfficialValidator( uitd );
        const errors = issues.filter( ( issue ) => issue.kind === "error" );
        const warnings = issues.filter( ( issue ) => issue.kind === "warning" );

        if ( errors.length > 0 ) {
            window.alert(
                `Se detectaron ${issues.length} problema(s) al validar el UITDL exportado.` +
                `\n\n${formatIssuesForPopup( issues )}\n\nLa exportacion se cancelara hasta que se resuelvan los errores.`
            );
            return;
        }

        if ( warnings.length > 0 ) {
            const ok = window.confirm(
                `Se detectaron ${warnings.length} advertencia(s) al validar el UITDL exportado.` +
                `\n\n${formatIssuesForPopup( warnings )}\n\n¿Deseas exportar de todos modos?`
            );
            if ( !ok ) return;
        }

        const blob = new Blob( [ uitd ], { type: "text/plain;charset=utf-8" } );
        const a = document.createElement( "a" );
        const url = URL.createObjectURL( blob );
        a.href = url;
        a.download = "diagram.uitd";
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
