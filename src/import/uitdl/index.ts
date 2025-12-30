// src/import/uitdl/index.ts
import type { AppState } from "../../state/types";
import { parseUITDL } from "./parser";
import { buildProjectFromAST } from "./build";
import { validateUITDLDoc } from "./validate";

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
        const code = it.code ? ` (${it.code})` : "";
        const prefix = [ tag, loc ].filter( Boolean ).join( " " );

        lines.push( `${prefix}${code}: ${it.message}` );
    }

    if ( issues.length > max ) {
        lines.push( `... (${issues.length - max} más)` );
    }

    return lines.join( "\n" );
}

export function importUITDL( text: string, base: AppState ) {
    console.log( "Importing UITDL... len=", text?.length );

    // 1) Parse (syntax-level issues)
    const ast = parseUITDL( text );
    const parseIssues = Array.isArray( ( ast as any ).issues ) ? ( ast as any ).issues : [];

    // 2) Semantic validation (policy-level issues)
    // NOTE: semantic validator expects the AST shape from ./types
    const semanticIssues = validateUITDLDoc( ast as any );

    // 3) Merge issues for the popup
    const issues = [ ...parseIssues, ...semanticIssues ];
    const hasErrors = issues.some( ( x: any ) => x?.kind === "error" );

    // ✅ If there are any issues, show popup and ask whether to continue
    if ( issues.length > 0 ) {
        const msg =
            `Se detectaron ${issues.length} problema(s) al importar UITDL` +
            ( hasErrors ? " (including errors)." : "." ) +
            `\n\n${formatIssuesForPopup( issues )}\n\n¿Deseas continuar de todos modos?`;

        const ok = window.confirm( msg );
        if ( !ok ) {
            throw new Error( "Import cancelled by user after issues." );
        }
    }

    // Debug summary
    console.log(
        "AST summary:",
        ast.uiBlocks.map( ( u: any ) => ( { key: u.key, name: u.name, actions: u.actions?.length ?? 0 } ) ),
        ast.fragments.map( ( f: any, i: number ) => ( {
            i,
            draw: f.draw?.length ?? 0,
            transitions: f.transitions?.length ?? 0,
            widthDefault: ( f as any ).widthDefault
        } ) )
    );

    // 4) Build project (graph) from AST
    const project = buildProjectFromAST( ast as any, base );

    console.log( "Built summary:", {
        nodes: project.nodes.length,
        actions: project.actions.length,
        conditions: project.conditions.length,
        edges: project.edges.length,
    } );

    return project;
}
