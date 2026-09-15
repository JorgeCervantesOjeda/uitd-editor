// src/import/uitdl/index.ts
import type { AppState } from "../../state/types";
import { parseUITDL as parseInternalUITDL } from "./parser";
import { buildProjectFromAST } from "./build";
import { callOfficialUITDLValidator } from "./officialValidatorCaller";
import type { ParseIssue } from "./types";

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
        const code = it.code ? `[${it.code}]` : "";
        const prefix = [ tag, code, loc ].filter( Boolean ).join( " " );

        lines.push( `${prefix}: ${it.message}` );
    }

    if ( issues.length > max ) {
        lines.push( `... (${issues.length - max} more)` );
    }

    return lines.join( "\n" );
}

export function importUITDL( text: string, base: AppState ) {
    console.log( "Importing UITDL... len=", text?.length );

    // 1) Official validator (syntax + semantics for UITDL text)
    const officialIssues = callOfficialUITDLValidator( text );
    const officialErrors = officialIssues.filter( ( x ) => x?.kind === "error" );

    if ( officialErrors.length > 0 ) {
        const msg =
            `${officialIssues.length} issue(s) were detected while validating UITDL.` +
            `\n\n${formatIssuesForPopup( officialIssues )}\n\nThe import will be cancelled until the errors are fixed.`;
        window.alert( msg );
        throw new Error( "Import blocked by official UITDL validator." );
    }

    // 2) Local parse, only to build the internal graph model.
    const ast = parseInternalUITDL( text );
    const parseIssues = Array.isArray( ast.issues ) ? ast.issues : [];
    const parseErrors = parseIssues.filter( ( x ) => x?.kind === "error" );

    if ( parseErrors.length > 0 ) {
        const msg =
            `${parseIssues.length} issue(s) were detected while converting UITDL to the internal model.` +
            `\n\n${formatIssuesForPopup( parseIssues )}\n\nThe import will be cancelled until the errors are fixed.`;
        window.alert( msg );
        throw new Error( "Import blocked by internal UITDL parser." );
    }

    // 3) Merge non-blocking warnings after both validation stages.
    const warnings = [
        ...officialIssues.filter( ( x ) => x?.kind === "warning" ),
        ...parseIssues.filter( ( x ) => x?.kind === "warning" ),
    ];

    if ( warnings.length > 0 ) {
        const msg =
            `${warnings.length} warning(s) were detected while importing UITDL.` +
            `\n\n${formatIssuesForPopup( warnings )}\n\nDo you want to continue anyway?`;
        const ok = window.confirm( msg );
        if ( !ok ) throw new Error( "Import cancelled by user after warnings." );
    }

    // Debug summary
    console.log(
        "AST summary:",
        ast.uiBlocks.map( ( u ) => ( { key: u.key, name: u.name, actions: u.actions?.length ?? 0 } ) ),
        ast.fragments.map( ( f, i: number ) => ( {
            i,
            draw: f.draw?.length ?? 0,
            transitions: f.transitions?.length ?? 0,
            widthDefault: f.widthDefault
        } ) )
    );

    // 4) Build project (graph) from AST
    const project = buildProjectFromAST( ast, base );

    console.log( "Built summary:", {
        nodes: project.nodes.length,
        actions: project.actions.length,
        conditions: project.conditions.length,
        edges: project.edges.length,
    } );

    return project;
}
