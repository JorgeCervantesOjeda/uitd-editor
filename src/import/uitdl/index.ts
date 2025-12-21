// src/import/uitdl/index.ts
import type { AppState } from "../../state/types";
import { parseUITDL } from "./parser";
import { buildProjectFromAST } from "./build";

function formatIssuesForPopup( issues: any[] ) {
    const lines: string[] = [];
    const max = 12;

    for ( let i = 0; i < Math.min( max, issues.length ); i++ ) {
        const it = issues[ i ];
        const loc =
            ( it.line != null && it.col != null )
                ? `L${it.line}:C${it.col}`
                : "";
        const tag = it.kind ? String( it.kind ).toUpperCase() : "ISSUE";
        lines.push( `- [${tag}]${loc ? ` (${loc})` : ""} ${it.message ?? String( it )}` );
    }

    if ( issues.length > max ) {
        lines.push( `... (${issues.length - max} más)` );
    }

    return lines.join( "\n" );
}

export function importUITDL( text: string, base: AppState ) {
    console.log( "Importing UITDL... len=", text?.length );
    const ast = parseUITDL( text );

    // ✅ Si hay issues, mostrar popup y pedir confirmación para continuar
    const issues = Array.isArray( ( ast as any ).issues ) ? ( ast as any ).issues : [];
    const hasErrors = issues.some( ( x: any ) => x?.kind === "error" );

    if ( issues.length > 0 ) {
        const msg =
            `Se detectaron ${issues.length} problema(s) al importar UITDL` +
            ( hasErrors ? " (incluye errores)." : "." ) +
            `\n\n${formatIssuesForPopup( issues )}\n\n¿Deseas continuar de todos modos?`;

        const ok = window.confirm( msg );
        if ( !ok ) {
            throw new Error( "Import cancelled by user after parse issues." );
        }
    }

    console.log(
        "AST summary:",
        ast.uiBlocks.map( u => ( { key: u.key, name: u.name, actions: u.actions?.length ?? 0 } ) ),
        ast.fragments.map( ( f, i ) => ( { i, draw: f.draw.length, trans: f.transitions.length, widthDefault: ( f as any ).widthDefault } ) )
    );

    const project = buildProjectFromAST( ast, base );

    console.log( "Built summary:", {
        nodes: project.nodes.length,
        actions: project.actions.length,
        conditions: project.conditions.length,
        edges: project.edges.length,
    } );

    return project;
}
