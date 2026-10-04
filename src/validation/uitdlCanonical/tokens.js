// src/validation/uitdlCanonical/tokens.js
// Canonical project-owned UITDL parser and semantic validator.

export const TokenType = {
    KEYWORD: 'KEYWORD',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    QUOTE: 'QUOTE',
    PUNCTUATION: 'PUNCTUATION',
    COMMENT: 'COMMENT',
    WHITESPACE: 'WHITESPACE',
    UNKNOWN: 'UNKNOWN'
};

export class Token {
    constructor( type, value, line, column ) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
}

export class Tokens {
    constructor() {
        this.tokens = [];
        this.currentTokenIndex = -1;
    }

    push( token ) {
        this.tokens.push( token );
    }

    getNext() {
        this.currentTokenIndex++;

        if( this.currentTokenIndex < this.tokens.length ) {
            return this.tokens[ this.currentTokenIndex ];
        }

        return { type: 'EOF' };
    }

    undoGetNextToken() {
        if( this.currentTokenIndex > 0 ) {
            this.currentTokenIndex--;
        }

        return this.tokens[ this.currentTokenIndex ];
    }
}


