// src/validation/uitdlCanonical/lexer.js
// Canonical project-owned UITDL parser and semantic validator.

import { Token, TokenType, Tokens } from './tokens.js';

const tokenSpec = [
    [ TokenType.KEYWORD, /\b(UITD|UI|FRAGMENT|DRAW|TRANSITION|actions|from|to|if|user|AND|clicks|submits|selects|types|toggles|uploads|downloads|saves|deletes|waits|WIDTH)\b/ ],
    [ TokenType.NUMBER, /\d+/ ],
    [ TokenType.QUOTE, /"/ ],
    [ TokenType.PUNCTUATION, /[{}[\](),;]/ ],
    [ TokenType.COMMENT, /#.*/ ],
    [ TokenType.WHITESPACE, /\s+/ ],
    [ TokenType.UNKNOWN, /[^\s{}[\](),;"#]+/ ]
];

export function tokenize( code ) {
    const tokens = new Tokens();
    let line = 1;
    let column = 1;
    let position = 0;

    while( position < code.length ) {
        let match = null;

        for( let [ type, pattern ] of tokenSpec ) {
            const regex = new RegExp( pattern );
            const sub = code.substring( position );
            match = regex.exec( sub );

            if( match && match.index === 0 ) {
                const value = match[ 0 ];

                if( type === TokenType.QUOTE ) {
                    tokens.push( new Token(
                        TokenType.QUOTE,
                        '"',
                        line,
                        column
                    ) );

                    let textStart = position + value.length;
                    let foundClosingQuote = false;

                    while( textStart < code.length ) {
                        const subText = code.substring( textStart );
                        const quoteMatch = /"/.exec( subText );

                        if( quoteMatch ) {
                            if( quoteMatch.index === 0 ) {
                                const characters = code.substring(
                                    position + 1,
                                    textStart
                                );
                                tokens.push( new Token(
                                    TokenType.STRING,
                                    characters,
                                    line,
                                    column + 1
                                ) );
                                tokens.push( new Token(
                                    TokenType.QUOTE,
                                    '"',
                                    line,
                                    column + 1 + characters.length + 1
                                ) );
                                position = textStart + quoteMatch.index + 1;
                                column += characters.length + 2;
                                foundClosingQuote = true;
                                break;
                            }

                            const characters = code.substring(
                                textStart,
                                textStart + quoteMatch.index
                            );
                            tokens.push( new Token(
                                TokenType.STRING,
                                characters,
                                line,
                                column + 1
                            ) );
                            tokens.push( new Token(
                                TokenType.QUOTE,
                                '"',
                                line,
                                column + 1 + characters.length + 1
                            ) );
                            position = textStart + quoteMatch.index + 1;
                            column += characters.length + 2;
                            foundClosingQuote = true;
                            break;
                        }

                        textStart++;
                    }

                    if( !foundClosingQuote ) {
                        const characters = code.substring( position + 1 );
                        tokens.push( new Token(
                            TokenType.STRING,
                            characters,
                            line,
                            column + 1
                        ) );
                        tokens.push( new Token(
                            TokenType.UNKNOWN,
                            ' ',
                            line,
                            column + 1 + characters.length
                        ) );
                        position = code.length;
                        column += characters.length + 1;
                    }
                } else if( type !== TokenType.WHITESPACE ) {
                    tokens.push( new Token(
                        type,
                        value,
                        line,
                        column
                    ) );
                    column += value.length;
                    position += value.length;
                } else {
                    const lines = value.split( '\n' );

                    if( lines.length > 1 ) {
                        line += lines.length - 1;
                        column = lines[ lines.length - 1 ].length + 1;
                    } else {
                        column += value.length;
                    }

                    position += value.length;
                }

                break;
            }
        }

        if( !match ) {
            throw new Error( `Unexpected character: ${code[ position ]} at position ${position}` );
        }
    }

    return tokens;
}


