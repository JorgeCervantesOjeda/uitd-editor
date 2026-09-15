// src/components/UITDLTextPanel/uitdlTabNavigation.ts
// Finds editable UITDL text fields for keyboard navigation inside the Monaco editor.

export type UITDLTextPosition = {
    lineNumber: number;
    column: number;
};

export type UITDLEditableFieldRange = {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
};

function comparePositions( left: UITDLTextPosition, right: UITDLTextPosition ): number {
    if ( left.lineNumber !== right.lineNumber ) return left.lineNumber - right.lineNumber;
    return left.column - right.column;
}

function fieldStartOf( field: UITDLEditableFieldRange ): UITDLTextPosition {
    return {
        lineNumber: field.startLineNumber,
        column: field.startColumn,
    };
}

function fieldEndOf( field: UITDLEditableFieldRange ): UITDLTextPosition {
    return {
        lineNumber: field.endLineNumber,
        column: field.endColumn,
    };
}

function addRange(
    fields: UITDLEditableFieldRange[],
    lineNumber: number,
    startColumn: number,
    endColumn: number
) {
    fields.push( {
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
    } );
}

function addTokenRange(
    fields: UITDLEditableFieldRange[],
    line: string,
    lineNumber: number,
    token: string,
    searchStartIndex = 0
): number {
    const tokenIndex = line.indexOf( token, searchStartIndex );
    if ( tokenIndex < 0 ) return searchStartIndex;
    addRange( fields, lineNumber, tokenIndex + 1, tokenIndex + token.length + 1 );
    return tokenIndex + token.length;
}

function addQuotedContentRange(
    fields: UITDLEditableFieldRange[],
    line: string,
    lineNumber: number,
    quoteIndex: number
): number {
    let cursor = quoteIndex + 1;
    while ( cursor < line.length ) {
        if ( line[ cursor ] === "\\" ) {
            cursor += 2;
            continue;
        }
        if ( line[ cursor ] === "\"" ) break;
        cursor++;
    }
    if ( cursor >= line.length ) return quoteIndex + 1;
    addRange( fields, lineNumber, quoteIndex + 2, cursor + 1 );
    return cursor + 1;
}

function addAllQuotedContentRanges(
    fields: UITDLEditableFieldRange[],
    line: string,
    lineNumber: number,
    startIndex = 0
) {
    let cursor = startIndex;
    while ( cursor < line.length ) {
        const quoteIndex = line.indexOf( "\"", cursor );
        if ( quoteIndex < 0 ) return;
        cursor = addQuotedContentRange( fields, line, lineNumber, quoteIndex );
    }
}

function addDrawFields( fields: UITDLEditableFieldRange[], line: string, lineNumber: number ) {
    const drawMatch = line.match( /\bDRAW\s*\{(?<body>.*)\}\s*;/ );
    const body = drawMatch?.groups?.body;
    if ( body == null ) return;

    const bodyStartIndex = line.indexOf( "{" ) + 1;
    for ( const match of body.matchAll( /[A-Za-z_][A-Za-z0-9_]*|\d+/g ) ) {
        addRange(
            fields,
            lineNumber,
            bodyStartIndex + ( match.index ?? 0 ) + 1,
            bodyStartIndex + ( match.index ?? 0 ) + match[ 0 ].length + 1
        );
    }
}

function addWidthFields( fields: UITDLEditableFieldRange[], line: string, lineNumber: number ) {
    for ( const match of line.matchAll( /\bWIDTH\s+(\d+)\b/g ) ) {
        addTokenRange( fields, line, lineNumber, match[ 1 ], ( match.index ?? 0 ) + "WIDTH".length );
    }
}

function addTransitionFields( fields: UITDLEditableFieldRange[], line: string, lineNumber: number ): boolean {
    const transitionMatch = line.match(
        /\bTRANSITION\s+from\s+(\S+)\s+to\s+(\S+)\s+if\s+user\s+([A-Za-z_][A-Za-z0-9_]*)\s+"/
    );
    if ( !transitionMatch ) return false;

    let searchStartIndex = transitionMatch.index ?? 0;
    searchStartIndex = addTokenRange( fields, line, lineNumber, transitionMatch[ 1 ], searchStartIndex );
    searchStartIndex = addTokenRange( fields, line, lineNumber, transitionMatch[ 2 ], searchStartIndex );
    searchStartIndex = addTokenRange( fields, line, lineNumber, transitionMatch[ 3 ], searchStartIndex );
    addAllQuotedContentRanges( fields, line, lineNumber, searchStartIndex );
    addWidthFields( fields, line, lineNumber );
    return true;
}

function addDeclarationFields( fields: UITDLEditableFieldRange[], line: string, lineNumber: number ) {
    const uitdMatch = line.match( /\bUITD\s+"/ );
    if ( uitdMatch ) {
        addQuotedContentRange( fields, line, lineNumber, line.indexOf( "\"", uitdMatch.index ) );
    }

    const uiMatch = line.match( /\bUI\s+([A-Za-z_][A-Za-z0-9_]*|\d+)\s+"/ );
    if ( uiMatch ) {
        const searchStartIndex = uiMatch.index ?? 0;
        addTokenRange( fields, line, lineNumber, uiMatch[ 1 ], searchStartIndex );
        addQuotedContentRange( fields, line, lineNumber, line.indexOf( "\"", searchStartIndex ) );
    }

    const fragmentMatch = line.match( /\bFRAGMENT\s+"/ );
    if ( fragmentMatch ) {
        addQuotedContentRange( fields, line, lineNumber, line.indexOf( "\"", fragmentMatch.index ) );
    }
}

function addActionFields( fields: UITDLEditableFieldRange[], line: string, lineNumber: number ) {
    const actionMatch = line.match( /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+"/ );
    if ( !actionMatch ) return;
    if ( [ "UITD", "FRAGMENT" ].includes( actionMatch[ 1 ] ) ) return;
    const searchStartIndex = actionMatch.index ?? 0;
    addTokenRange( fields, line, lineNumber, actionMatch[ 1 ], searchStartIndex );
    addQuotedContentRange( fields, line, lineNumber, line.indexOf( "\"", searchStartIndex ) );
}

export function collectUITDLEditableFields( text: string ): UITDLEditableFieldRange[] {
    const fields: UITDLEditableFieldRange[] = [];
    const lines = text.split( /\r?\n/ );

    lines.forEach( ( line, lineIndex ) => {
        const lineNumber = lineIndex + 1;
        const hasTransition = addTransitionFields( fields, line, lineNumber );
        if ( !hasTransition ) {
            addDeclarationFields( fields, line, lineNumber );
            addActionFields( fields, line, lineNumber );
        }
        addDrawFields( fields, line, lineNumber );
        addWidthFields( fields, line, lineNumber );
    } );

    return fields.sort( ( left, right ) => comparePositions( fieldStartOf( left ), fieldStartOf( right ) ) );
}

export function findNextUITDLEditableField(
    text: string,
    position: UITDLTextPosition,
    direction: "next" | "previous" = "next"
): UITDLEditableFieldRange | null {
    const fields = collectUITDLEditableFields( text );
    if ( fields.length === 0 ) return null;

    if ( direction === "previous" ) {
        return [ ...fields ]
            .reverse()
            .find( field => comparePositions( fieldEndOf( field ), position ) < 0 ) ?? fields[ fields.length - 1 ];
    }

    return fields.find( field => comparePositions( fieldStartOf( field ), position ) > 0 ) ?? fields[ 0 ];
}
