// src/components/UITDLTextPanel/formatUITDL.ts
// Formats UITDL structure while preserving whitespace and punctuation inside quoted strings.

function appendNormalizedCharacter( buffer: string, character: string ): string {
    if ( /\s/.test( character ) ) {
        return buffer && !buffer.endsWith( " " ) ? `${buffer} ` : buffer;
    }
    return `${buffer}${character}`;
}

export function formatUITDL( source: string ): string {
    const lines: string[] = [];
    let buffer = "";
    let depth = 0;
    let isInString = false;
    let isEscaped = false;

    const emitBuffer = () => {
        const content = buffer.trim();
        buffer = "";
        if ( !content ) return;
        lines.push( `${"    ".repeat( depth )}${content}` );
    };

    for ( let index = 0; index < source.length; index++ ) {
        const character = source[ index ];

        if ( isInString ) {
            buffer += character;
            if ( character === "\"" && !isEscaped ) isInString = false;
            isEscaped = character === "\\" && !isEscaped;
            if ( character !== "\\" ) isEscaped = false;
            continue;
        }

        if ( character === "\"" ) {
            isInString = true;
            buffer = appendNormalizedCharacter( buffer, character );
            continue;
        }

        if ( character === "{" ) {
            const prefix = buffer.trimEnd();
            buffer = prefix ? `${prefix} {` : "{";
            emitBuffer();
            depth++;
            continue;
        }

        if ( character === "}" ) {
            emitBuffer();
            depth = Math.max( 0, depth - 1 );
            lines.push( `${"    ".repeat( depth )}}` );
            continue;
        }

        if ( character === ";" ) {
            if ( buffer.trim() ) {
                buffer = `${buffer.trimEnd()};`;
                emitBuffer();
            } else if ( lines.length > 0 ) {
                lines[ lines.length - 1 ] = `${lines[ lines.length - 1 ]};`;
            }
            continue;
        }

        if ( character === "," ) {
            buffer = `${buffer.trimEnd()}, `;
            while ( /\s/.test( source[ index + 1 ] ?? "" ) ) index++;
            continue;
        }

        if ( character === "(" || character === "[" ) {
            buffer = `${buffer.trimEnd()}${character}`;
            while ( /\s/.test( source[ index + 1 ] ?? "" ) ) index++;
            continue;
        }

        if ( character === ")" || character === "]" ) {
            buffer = `${buffer.trimEnd()}${character}`;
            while ( /\s/.test( source[ index + 1 ] ?? "" ) ) index++;
            continue;
        }

        buffer = appendNormalizedCharacter( buffer, character );
    }

    emitBuffer();
    return `${lines.join( "\n" ).trim()}\n`;
}
