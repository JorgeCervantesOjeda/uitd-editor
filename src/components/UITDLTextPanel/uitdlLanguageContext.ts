// src/components/UITDLTextPanel/uitdlLanguageContext.ts
// Extracts tolerant UITDL context for Monaco completion and hover while text is incomplete.

import { isUiVerb, type UiVerb } from "../../model/uiVerbs";

export type UIContext = {
    id: string;
    name: string;
    actions: Array<{ verb: UiVerb; complement: string }>;
};

export type CompletionContext = {
    type: "draw-ui" | "transition-from" | "transition-to" | "transition-action" | "transition-complement";
    startColumn: number;
    endColumn: number;
    prefix: string;
    fromReference?: string;
    verb?: string;
};

type DrawReference = { id: string; children: DrawReference[] };

export function collectUIContext( text: string ): UIContext[] {
    const contexts: UIContext[] = [];
    const uiPattern = /\bUI\s+(\d+)\s+"([^"]*)"\s+actions\s*\{([\s\S]*?)\}/g;
    let uiMatch: RegExpExecArray | null;
    while ( ( uiMatch = uiPattern.exec( text ) ) !== null ) {
        const actions: UIContext[ "actions" ] = [];
        const actionPattern = /\b([A-Za-z]+)\s+"([^"]*)"\s*;/g;
        let actionMatch: RegExpExecArray | null;
        while ( ( actionMatch = actionPattern.exec( uiMatch[ 3 ] ) ) !== null ) {
            if ( !isUiVerb( actionMatch[ 1 ] ) ) continue;
            actions.push( { verb: actionMatch[ 1 ], complement: actionMatch[ 2 ] } );
        }
        contexts.push( { id: uiMatch[ 1 ], name: uiMatch[ 2 ], actions } );
    }
    return contexts.sort( ( first, second ) => Number( first.id ) - Number( second.id ) );
}

export function innermostUIId( reference: string | undefined ): string | null {
    const ids = reference?.match( /\d+/g );
    return ids?.[ ids.length - 1 ] ?? null;
}

function parseDrawReferences( source: string ): DrawReference[] {
    let index = 0;
    const skipWhitespace = () => {
        while ( /\s/.test( source[ index ] ?? "" ) ) index++;
    };
    const parseList = ( closing = "" ): DrawReference[] => {
        const references: DrawReference[] = [];
        while ( index < source.length ) {
            skipWhitespace();
            if ( closing && source[ index ] === closing ) {
                index++;
                break;
            }
            const id = source.slice( index ).match( /^\d+/ )?.[ 0 ];
            if ( !id ) break;
            index += id.length;
            skipWhitespace();
            const reference: DrawReference = { id, children: [] };
            if ( source[ index ] === "[" || source[ index ] === "(" ) {
                const closingToken = source[ index ] === "[" ? "]" : ")";
                index++;
                reference.children = parseList( closingToken );
            }
            references.push( reference );
            skipWhitespace();
            if ( source[ index ] === "," ) index++;
        }
        return references;
    };
    return parseList();
}

function formatReference( path: string[] ): string {
    return path.reduceRight<string>(
        ( nested, id ) => nested ? `${id}(${nested})` : id,
        ""
    );
}

function findFragmentTextAtLine( text: string, lineNumber: number ): string | null {
    const lineOffsets = [ 0 ];
    for ( let index = 0; index < text.length; index++ ) {
        if ( text[ index ] === "\n" ) lineOffsets.push( index + 1 );
    }
    const cursorOffset = lineOffsets[ lineNumber - 1 ] ?? 0;
    const fragmentPattern = /\bFRAGMENT\s+"[^"]*"\s*\{/g;
    let match: RegExpExecArray | null;
    while ( ( match = fragmentPattern.exec( text ) ) !== null ) {
        const openIndex = text.indexOf( "{", match.index );
        let depth = 0;
        for ( let index = openIndex; index < text.length; index++ ) {
            if ( text[ index ] === "{" ) depth++;
            if ( text[ index ] === "}" ) depth--;
            if ( depth === 0 ) {
                if ( cursorOffset >= match.index && cursorOffset <= index ) {
                    return text.slice( match.index, index + 1 );
                }
                break;
            }
        }
    }
    return null;
}

function findDrawContext(
    text: string,
    lineNumber: number,
    column: number
): CompletionContext | null {
    const lineOffsets = [ 0 ];
    for ( let index = 0; index < text.length; index++ ) {
        if ( text[ index ] === "\n" ) lineOffsets.push( index + 1 );
    }
    const lineStart = lineOffsets[ lineNumber - 1 ] ?? 0;
    const cursorOffset = lineStart + column - 1;
    const drawPattern = /\bDRAW\s*\{/g;
    let drawMatch: RegExpExecArray | null;
    while ( ( drawMatch = drawPattern.exec( text ) ) !== null ) {
        const openIndex = text.indexOf( "{", drawMatch.index );
        const closeIndex = text.indexOf( "}", openIndex + 1 );
        if ( closeIndex < 0 || cursorOffset < openIndex + 1 || cursorOffset > closeIndex ) continue;
        let tokenStart = cursorOffset;
        while ( tokenStart > openIndex + 1 && /\d/.test( text[ tokenStart - 1 ] ) ) tokenStart--;
        if ( tokenStart < lineStart ) tokenStart = cursorOffset;
        return {
            type: "draw-ui",
            prefix: text.slice( tokenStart, cursorOffset ),
            startColumn: tokenStart - lineStart + 1,
            endColumn: column,
        };
    }
    return null;
}

export function collectFragmentTransitionReferences( text: string, lineNumber: number ): string[] {
    const fragmentText = findFragmentTextAtLine( text, lineNumber );
    if ( !fragmentText ) return [];
    const references = new Set<string>();
    const drawPattern = /\bDRAW\s*\{([^}]*)\}\s*;/g;
    let drawMatch: RegExpExecArray | null;
    while ( ( drawMatch = drawPattern.exec( fragmentText ) ) !== null ) {
        const visit = ( reference: DrawReference, ancestors: string[] ) => {
            const path = [ ...ancestors, reference.id ];
            references.add( formatReference( path ) );
            for ( const child of reference.children ) visit( child, path );
        };
        for ( const reference of parseDrawReferences( drawMatch[ 1 ] ) ) visit( reference, [] );
    }
    return [ ...references ].sort( ( first, second ) =>
        first.split( "(" ).length - second.split( "(" ).length ||
        first.localeCompare( second, undefined, { numeric: true } )
    );
}

export function findCompletionContext(
    text: string,
    lineContent: string,
    lineNumber: number,
    column: number
): CompletionContext | null {
    const beforeCursor = lineContent.slice( 0, column - 1 );
    const complementMatch = beforeCursor.match(
        /\bTRANSITION\s+from\s+([0-9()]+)\s+to\s+[0-9()]+\s+if\s+user\s+([A-Za-z]+)\s+"([^"]*)$/
    );
    if ( complementMatch ) {
        return {
            type: "transition-complement",
            fromReference: complementMatch[ 1 ],
            verb: complementMatch[ 2 ],
            prefix: complementMatch[ 3 ],
            startColumn: column - complementMatch[ 3 ].length,
            endColumn: column,
        };
    }
    const actionMatch = beforeCursor.match(
        /\bTRANSITION\s+from\s+([0-9()]+)\s+to\s+[0-9()]+\s+if\s+user\s+([A-Za-z]*)$/
    );
    if ( actionMatch ) {
        return {
            type: "transition-action",
            fromReference: actionMatch[ 1 ],
            prefix: actionMatch[ 2 ],
            startColumn: column - actionMatch[ 2 ].length,
            endColumn: column,
        };
    }
    const toMatch = beforeCursor.match( /\bTRANSITION\s+from\s+[0-9()]+\s+to\s+([0-9()]*)$/ );
    if ( toMatch ) {
        return {
            type: "transition-to",
            prefix: toMatch[ 1 ],
            startColumn: column - toMatch[ 1 ].length,
            endColumn: column,
        };
    }
    const fromMatch = beforeCursor.match( /\bTRANSITION\s+from\s+([0-9()]*)$/ );
    if ( fromMatch ) {
        return {
            type: "transition-from",
            prefix: fromMatch[ 1 ],
            startColumn: column - fromMatch[ 1 ].length,
            endColumn: column,
        };
    }

    return findDrawContext( text, lineNumber, column );
}
