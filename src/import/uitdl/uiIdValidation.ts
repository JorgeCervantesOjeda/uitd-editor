// src/import/uitdl/uiIdValidation.ts
// Validates lexical UIID constraints that are stricter than generic NUMBER tokens.

import { Lexer, type Token } from "./lexer";
import type { ParseIssue } from "./types";

export function hasLeadingZeroUIID( value: string ): boolean {
    return /^0\d+$/.test( value );
}

export function leadingZeroUIIDMessage( value: string ): string {
    return `Invalid UIID "${value}": UI IDs must not contain leading zeros.`;
}

function issueOf( token: Token ): ParseIssue | null {
    if ( token.kind !== "NUMBER" || !token.value || !hasLeadingZeroUIID( token.value ) ) return null;
    return {
        kind: "error",
        message: leadingZeroUIIDMessage( token.value ),
        line: token.line,
        col: token.col,
    };
}

function pushIssue( issues: ParseIssue[], token: Token | undefined, seen: Set<string> ) {
    if ( !token ) return;
    const issue = issueOf( token );
    if ( !issue ) return;
    const key = `${issue.line}:${issue.col}`;
    if ( seen.has( key ) ) return;
    seen.add( key );
    issues.push( issue );
}

export function validateNoLeadingZeroUIIDs( text: string ): ParseIssue[] {
    const lexer = new Lexer( text );
    const tokens: Token[] = [];
    const issues: ParseIssue[] = [];
    const seen = new Set<string>();

    while ( true ) {
        const token = lexer.nextToken();
        tokens.push( token );
        if ( token.kind === "EOF" ) break;
    }

    for ( let index = 0; index < tokens.length; index++ ) {
        const token = tokens[ index ];
        if ( token.kind !== "KW" ) continue;

        if ( token.value === "UI" ) {
            pushIssue( issues, tokens[ index + 1 ], seen );
            continue;
        }

        if ( token.value === "DRAW" ) {
            for ( let nextIndex = index + 1; nextIndex < tokens.length; nextIndex++ ) {
                const nextToken = tokens[ nextIndex ];
                if ( nextToken.kind === "SEMI" || nextToken.kind === "EOF" ) break;
                pushIssue( issues, nextToken, seen );
            }
            continue;
        }

        if ( token.value === "TRANSITION" ) {
            for ( let nextIndex = index + 1; nextIndex < tokens.length; nextIndex++ ) {
                const nextToken = tokens[ nextIndex ];
                if ( nextToken.kind === "KW" && nextToken.value === "if" ) break;
                if ( nextToken.kind === "SEMI" || nextToken.kind === "EOF" ) break;
                pushIssue( issues, nextToken, seen );
            }
        }
    }

    return issues;
}
