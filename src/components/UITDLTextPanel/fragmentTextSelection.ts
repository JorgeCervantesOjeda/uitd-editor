// src/components/UITDLTextPanel/fragmentTextSelection.ts
// Resolves textual fragments to canvas groups without relying on their relative order.

import { buildFragmentGroups, resolveFragmentTitle } from "../../fragments/fragmentModel";
import { Lexer } from "../../import/uitdl/lexer";
import { parseUITDL } from "../../import/uitdl/parser";
import type { FragmentAST, UiRef } from "../../import/uitdl/types";
import type { IncrementalUITDLResult, LiveSyncSelection } from "../../import/uitdl/incremental";

type FragmentSelectionProject = Pick<IncrementalUITDLResult, "nodes" | "actions" | "conditions" | "edges"> & {
    fragmentTitles?: Record<string, string>;
};

function parseFragmentAtLine( lines: string[], lineNumber: number ): FragmentAST | null {
    if ( !/^\s*FRAGMENT\b/.test( lines[ lineNumber - 1 ] ?? "" ) ) return null;
    const source = lines.slice( lineNumber - 1 ).join( "\n" );
    const lexer = new Lexer( source );
    let depth = 0;
    let hasBody = false;
    for ( let token = lexer.nextToken(); token.kind !== "EOF"; token = lexer.nextToken() ) {
        if ( token.kind === "LBRACE" ) {
            depth++;
            hasBody = true;
        }
        if ( token.kind !== "RBRACE" ) continue;
        depth--;
        if ( !hasBody || depth !== 0 ) continue;
        const fragmentLines = source.split( "\n" ).slice( 0, token.line );
        fragmentLines[ token.line - 1 ] = fragmentLines[ token.line - 1 ].slice( 0, token.col );
        return parseUITDL( `UITD "Selection" {\n${fragmentLines.join( "\n" )}\n}` ).fragments[ 0 ] ?? null;
    }
    return null;
}

function serializeDrawReferences( references: UiRef[] ): string {
    return JSON.stringify( references.map( reference => [
        reference.key,
        serializeDrawReferences( reference.children ),
    ] ).sort( ( left, right ) => JSON.stringify( left ).localeCompare( JSON.stringify( right ) ) ) );
}

export function resolveFragmentTextSelection(
    lines: string[],
    lineNumber: number,
    project: FragmentSelectionProject
): LiveSyncSelection | null {
    let fragment: FragmentAST | null;
    try {
        fragment = parseFragmentAtLine( lines, lineNumber );
    } catch ( error ) {
        console.warn( "[UITDL selection] Could not parse the clicked fragment.", {
            cause: error,
            fallback: "Keeping the current canvas selection.",
            impact: "The fragment cannot be selected from this text position.",
        } );
        return null;
    }
    if ( !fragment ) return null;

    const groups = buildFragmentGroups( project );
    const namedGroups = groups.filter( ( group, indexOfGroup ) =>
        resolveFragmentTitle( project.fragmentTitles, group.id, indexOfGroup ) === fragment.name.trim()
    );
    let group = namedGroups.length === 1 ? namedGroups[ 0 ] : null;
    if ( !group ) {
        const signature = serializeDrawReferences( fragment.draw );
        const matchingGroups = ( namedGroups.length > 0 ? namedGroups : groups ).filter( candidate => {
            const members = project.nodes.filter( node => candidate.nodeIds.includes( node.id ) );
            const memberIds = new Set( candidate.nodeIds );
            const buildReference = ( node: typeof members[ number ] ): UiRef => ( {
                key: ( node.displayId ?? String( node.id ) ).trim(),
                children: members.filter( child => child.parentId === node.id ).map( buildReference ),
            } );
            const roots = members.filter( node => node.parentId == null || !memberIds.has( node.parentId ) );
            return serializeDrawReferences( roots.map( buildReference ) ) === signature;
        } );
        group = matchingGroups.length === 1 ? matchingGroups[ 0 ] : null;
        console.info( "[UITDL selection] Fragment title did not identify one canvas group.", {
            cause: `Found ${namedGroups.length} groups matching the fragment title.`,
            fallback: group ? "Using the unique DRAW containment match." : "Keeping the current canvas selection.",
            impact: group ? "Selection follows fragment contents instead of group order." : "Ambiguous or missing fragments are not selected.",
        } );
    }
    if ( !group ) return null;
    return {
        nodes: new Set( group.nodeIds ),
        actions: new Set( group.actionIds ),
        conditions: new Set( group.conditionIds ),
    };
}
