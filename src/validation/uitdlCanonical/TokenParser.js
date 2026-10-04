// src/validation/uitdlCanonical/TokenParser.js
// Canonical project-owned UITDL parser and semantic validator.

import { tokenize } from './lexer.js';
import { TokenType } from './tokens.js';
import { getInnermostUIStr, getInnermostUIRef, formatUIRef } from './utils.js';
import { validateData } from './validation.js';

export const validVerbs = [
    'clicks', 'submits', 'selects', 'types', 'toggles',
    'uploads', 'downloads', 'saves', 'deletes', 'waits'
];

class TokenParser {
    constructor( tokens ) {
        this.tokens = tokens;
        this.currentToken = null;
        this.result = null;
    }

    initializeResult() {
        this.result = {
            name: '',
            uis: [],
            fragments: [],
            declarations: [],
            errors: [],
        };
    }

    getNextToken() {
        let token;

        do {
            token = this.tokens.getNext();
        } while( token && token.type === TokenType.COMMENT );

        this.currentToken = token;
        return this.currentToken;
    }

    undoGetNextToken() {
        this.currentToken = this.tokens.undoGetNextToken();
    }

    expectToken( type, value = null ) {
        const token = this.getNextToken();
        this.currentToken = token;

        if( type === TokenType.STRING ) {
            if( token.type !== TokenType.QUOTE || ( value && token.value !== '"' ) ) {
                throw new Error( `Expected opening quote, but got ${token.value} at line ${token.line}, column ${token.column}` );
            }

            const stringToken = this.getNextToken();

            if( stringToken.type !== TokenType.STRING ) {
                throw new Error( `Expected string, but got ${stringToken.value} at line ${stringToken.line}, column ${stringToken.column}` );
            }

            const closingQuoteToken = this.getNextToken();

            if( closingQuoteToken.type !== TokenType.QUOTE || ( value && closingQuoteToken.value !== '"' ) ) {
                throw new Error( `Expected closing quote, but got ${closingQuoteToken.value} at line ${closingQuoteToken.line}, column ${closingQuoteToken.column}` );
            }

            if( stringToken.value.includes( '  ' ) ) {
                stringToken.value = stringToken.value.replace( / {2,}/g, ' ' );
                this.result.errors.push( {
                    severity: 4,
                    startLineNumber: stringToken.line,
                    lineNumber: stringToken.line,
                    startColumn: stringToken.column,
                    endColumn: stringToken.column + stringToken.value.length,
                    message: 'Double space',
                } );
            }

            return stringToken;
        }

        if( token.type !== type || ( value && token.value !== value ) ) {
            throw new Error( `Expected ${value || type}, but got ${token.value} at line ${token.line}, column ${token.column}` );
        }

        return token;
    }

    handleParsingError( error ) {
        const token = this.currentToken;
        this.result.errors.push( {
            severity: 8,
            startLineNumber: token ? token.line : 0,
            lineNumber: token ? token.line : 0,
            startColumn: token ? token.column : 0,
            endColumn: token ? token.column + ( token.value ? token.value.length : 0 ) : 0,
            message: error.message
        } );
    }

    parse() {
        this.initializeResult();

        try {
            this.expectToken( TokenType.KEYWORD, 'UITD' );
            const titleToken = this.expectToken( TokenType.STRING );
            this.result.name = titleToken.value;
            this.expectToken( TokenType.PUNCTUATION, '{' );

            let token = this.getNextToken();

            while( token.type !== TokenType.PUNCTUATION || token.value !== '}' ) {
                try {
                    if( token.type === TokenType.KEYWORD && token.value === 'UI' ) {
                        this.undoGetNextToken();
                        this.parseUI();
                    } else if( token.type === TokenType.KEYWORD && token.value === 'FRAGMENT' ) {
                        this.undoGetNextToken();
                        this.parseFragment();
                    } else {
                        throw new Error( `Unexpected token ${token.value} at line ${token.line}, column ${token.column}` );
                    }

                    token = this.getNextToken();
                } catch( error ) {
                    this.handleParsingError( error );
                    break;
                }
            }
        } catch( error ) {
            this.handleParsingError( error );
        }

        this.processFullField();

        const validationErrors = validateData( this.result );
        this.result.errors = [ ...this.result.errors, ...validationErrors ];

        return this.result;
    }

    parseUI() {
        try {
            const uiStartToken = this.expectToken( TokenType.KEYWORD, 'UI' );
            const idToken = this.expectToken( TokenType.NUMBER );
            const uiId = idToken.value;
            const nameToken = this.expectToken( TokenType.STRING );
            const uiName = nameToken.value;
            this.expectToken( TokenType.KEYWORD, 'actions' );
            this.expectToken( TokenType.PUNCTUATION, '{' );

            const actions = [];
            let token = this.getNextToken();

            while( token.type !== TokenType.PUNCTUATION || token.value !== '}' ) {
                if( validVerbs.includes( token.value ) ) {
                    const verb = token.value;
                    const targetToken = this.expectToken( TokenType.STRING );
                    const target = targetToken.value;

                    actions.push( { verb, target, line: token.line, column: token.column } );
                    this.expectToken( TokenType.PUNCTUATION, ';' );
                } else {
                    throw new Error( `Unexpected token ${token.value} in UI actions at line ${token.line}, column ${token.column}` );
                }

                token = this.getNextToken();
            }

            this.result.uis.push( {
                id: uiId,
                name: uiName,
                actions,
                line: uiStartToken.line,
                column: uiStartToken.column,
                idLine: idToken.line,
                idColumn: idToken.column
            } );
            this.result.declarations.push( {
                type: 'UI',
                id: uiId.toString(),
                line: uiStartToken.line,
                column: uiStartToken.column,
            } );
        } catch( error ) {
            this.handleParsingError( error );
        }
    }

    parseFragment() {
        try {
            const fragmentStartToken = this.expectToken( TokenType.KEYWORD, 'FRAGMENT' );
            const nameToken = this.expectToken( TokenType.STRING );
            const fragmentName = nameToken.value;
            this.expectToken( TokenType.PUNCTUATION, '{' );

            const draws = [];
            const transitions = [];
            let width = null;
            let token = this.getNextToken();

            while( !( token.type === TokenType.PUNCTUATION && token.value === '}' ) ) {
                try {
                    if( token.type === TokenType.KEYWORD && token.value === 'WIDTH' ) {
                        const widthToken = this.expectToken( TokenType.NUMBER );
                        width = parseInt( widthToken.value, 10 );
                        this.expectToken( TokenType.PUNCTUATION, ';' );
                    } else if( token.type === TokenType.KEYWORD && token.value === 'DRAW' ) {
                        this.undoGetNextToken();
                        this.parseDraw( draws );
                    } else if( token.type === TokenType.KEYWORD && token.value === 'TRANSITION' ) {
                        this.undoGetNextToken();
                        this.parseTransition( transitions );
                    } else {
                        throw new Error( `Unexpected token ${token.value} in FRAGMENT at line ${token.line}, column ${token.column}` );
                    }

                    token = this.getNextToken();
                } catch( error ) {
                    this.handleParsingError( error );
                    break;
                }
            }

            this.result.fragments.push( {
                name: fragmentName,
                width,
                draws,
                transitions,
                line: fragmentStartToken.line,
                column: fragmentStartToken.column,
                endLineNumber: token.line
            } );
            this.result.declarations.push( {
                type: 'FRAGMENT',
                name: fragmentName,
                line: fragmentStartToken.line,
                column: fragmentStartToken.column,
            } );
        } catch( error ) {
            this.handleParsingError( error );
        }
    }

    parseDraw( draws ) {
        try {
            const drawToken = this.expectToken( TokenType.KEYWORD, 'DRAW' );
            this.expectToken( TokenType.PUNCTUATION, '{' );
            const uiRefs = this.parseDrawUIRefList();
            this.expectToken( TokenType.PUNCTUATION, '}' );
            this.expectToken( TokenType.PUNCTUATION, ';' );
            draws.push( { uiRefs, line: drawToken.line, column: drawToken.column } );
        } catch( error ) {
            this.handleParsingError( error );
        }
    }

    parseDrawUIRefList( closingToken = '}' ) {
        const uiRefs = [];
        let token = this.getNextToken();

        while( !( token.type === TokenType.PUNCTUATION && token.value === closingToken ) ) {
            this.undoGetNextToken();
            uiRefs.push( this.parseDrawUIRef() );
            token = this.getNextToken();

            if( token.type === TokenType.PUNCTUATION && token.value === ',' ) {
                token = this.getNextToken();
            }
        }

        this.undoGetNextToken();
        return uiRefs;
    }

    parseDrawUIRef() {
        const idToken = this.expectToken( TokenType.NUMBER );
        const uiRef = {
            id: idToken.value,
            nested: [],
            full: false,
            drawDelimiter: null,
            line: idToken.line,
            column: idToken.column,
            nestedColumn: null
        };
        const nextToken = this.getNextToken();

        if( nextToken.type === TokenType.PUNCTUATION &&
            ( nextToken.value === '[' || nextToken.value === '(' ) ) {
            uiRef.drawDelimiter = nextToken.value;
            uiRef.nestedColumn = nextToken.column;
            const closingToken = nextToken.value === '[' ? ']' : ')';
            uiRef.nested = this.parseDrawUIRefList( closingToken );
            this.expectToken(
                TokenType.PUNCTUATION,
                nextToken.value === '[' ? ']' : ')'
            );
        } else {
            this.undoGetNextToken();
        }

        return uiRef;
    }

    parseTransitionUIRef() {
        const idToken = this.expectToken( TokenType.NUMBER );
        const uiRef = {
            id: idToken.value,
            nested: [],
            full: false,
            line: idToken.line,
            column: idToken.column
        };
        const nextToken = this.getNextToken();

        if( nextToken.type === TokenType.PUNCTUATION && nextToken.value === '(' ) {
            uiRef.nested = [ this.parseTransitionUIRef() ];
            this.expectToken( TokenType.PUNCTUATION, ')' );
        } else {
            this.undoGetNextToken();
        }

        return uiRef;
    }

    parseTransition( transitions ) {
        try {
            const startToken = this.expectToken( TokenType.KEYWORD, 'TRANSITION' );
            this.expectToken( TokenType.KEYWORD, 'from' );
            const from = this.parseTransitionUIRef();
            this.expectToken( TokenType.KEYWORD, 'to' );
            const to = this.parseTransitionUIRef();
            this.expectToken( TokenType.KEYWORD, 'if' );
            this.expectToken( TokenType.KEYWORD, 'user' );
            const actionToken = this.expectToken( TokenType.KEYWORD );
            const action = actionToken.value;
            const targetToken = this.expectToken( TokenType.STRING );
            const target = targetToken.value;

            let condition = '';
            const nextToken = this.getNextToken();

            if( nextToken.type === TokenType.KEYWORD && nextToken.value === 'AND' ) {
                const conditionToken = this.expectToken( TokenType.STRING );
                condition = conditionToken.value;
            } else {
                this.undoGetNextToken();
            }

            let width = null;
            const nextWidthToken = this.getNextToken();

            if( nextWidthToken.type === TokenType.KEYWORD && nextWidthToken.value === 'WIDTH' ) {
                const widthToken = this.expectToken( TokenType.NUMBER );
                width = parseInt( widthToken.value, 10 );
            } else {
                this.undoGetNextToken();
            }

            this.expectToken( TokenType.PUNCTUATION, ';' );

            transitions.push( {
                from,
                to,
                action,
                target,
                condition,
                width,
                line: startToken.line,
                column: startToken.column,
                verbColumn: actionToken.column,
            } );
        } catch( error ) {
            this.handleParsingError( error );
        }
    }

    processFullField() {
        const allTransitions = this.gatherAllTransitions();

        this.result.fragments.forEach( fragment => {
            const fragmentTransitions = this.gatherFragmentTransitions( fragment );

            const processRef = ( ref, parentId = null ) => {
                const refIdStr = parentId ? `${parentId}(${ref.id})` : ref.id;
                const innermostId = getInnermostUIStr( refIdStr );
                const allTransitionsSet = allTransitions[ innermostId ] || new Set();
                const fragmentTransitionsSet = fragmentTransitions[ refIdStr ] || new Set();

                ref.full = allTransitionsSet.size > 0 &&
                    allTransitionsSet.size === fragmentTransitionsSet.size;

                ref.nested.forEach( nestedRef => processRef( nestedRef, ref.id ) );
            };

            fragment.draws.forEach( ( { uiRefs } ) => {
                uiRefs.forEach( ref => {
                    processRef( ref, null );
                } );
            } );
        } );
    }

    gatherAllTransitions() {
        const uiTransitions = {};

        this.result.fragments.forEach( fragment => {
            fragment.transitions.forEach( transition => {
                const fromUI = getInnermostUIRef( transition.from );
                const toUI = getInnermostUIRef( transition.to );

                if( !uiTransitions[ fromUI ] ) {
                    uiTransitions[ fromUI ] = new Set();
                }

                if( !uiTransitions[ toUI ] ) {
                    uiTransitions[ toUI ] = new Set();
                }

                const transitionStr = `${fromUI}->${toUI}:${transition.action} "${transition.target}" ${transition.condition ? 'AND\n(' + transition.condition + ')' : ''}`;
                uiTransitions[ fromUI ].add( transitionStr );
                uiTransitions[ toUI ].add( transitionStr );
            } );
        } );

        return uiTransitions;
    }

    gatherFragmentTransitions( fragment ) {
        const fragmentTransitions = {};

        fragment.transitions.forEach( transition => {
            const fromKey = formatUIRef( transition.from );
            const toKey = formatUIRef( transition.to );

            if( !fragmentTransitions[ fromKey ] ) {
                fragmentTransitions[ fromKey ] = new Set();
            }

            if( !fragmentTransitions[ toKey ] ) {
                fragmentTransitions[ toKey ] = new Set();
            }

            const transitionStr = `${fromKey}->${toKey}:${transition.action} "${transition.target}" ${transition.condition ? 'AND\n(' + transition.condition + ')' : ''}`;
            fragmentTransitions[ fromKey ].add( transitionStr );
            fragmentTransitions[ toKey ].add( transitionStr );
        } );

        return fragmentTransitions;
    }
}

export function parseUITDL( text ) {
    const tokens = tokenize( text );
    const parser = new TokenParser( tokens );
    return parser.parse();
}


