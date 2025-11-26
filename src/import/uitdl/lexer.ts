export type Tok =
    | { k: "KW"; v: string; i: number; line: number; col: number }
    | { k: "NUM"; v: string; i: number; line: number; col: number }
    | { k: "STR"; v: string; i: number; line: number; col: number }
    | { k: "SYM"; v: "{" | "}" | "(" | ")" | "," | ";"; i: number; line: number; col: number };

const KEYWORDS = new Set( [
    "UITD", "UI", "actions", "FRAGMENT", "DRAW", "TRANSITION",
    "from", "to", "if", "user", "AND"
] ); // case sensitive

export function lex( input: string ): Tok[] {
    const tks: Tok[] = [];
    let i = 0, line = 1, col = 1;
    const n = input.length;

    const push = ( t: Tok ) => tks.push( t );
    const adv = ( c: string ) => { i++; if ( c === "\n" ) { line++; col = 1; } else { col++; } };

    const isWs = ( c: string ) => c === " " || c === "\t" || c === "\r" || c === "\n";
    const isDigit = ( c: string ) => c >= "0" && c <= "9";

    while ( i < n ) {
        const c = input[ i ];

        // comentario con #
        if ( c === "#" ) {
            while ( i < n && input[ i ] !== "\n" ) adv( input[ i ] );
            continue;
        }

        // whitespace
        if ( isWs( c ) ) { adv( c ); continue; }

        // strings "..."
        if ( c === '"' ) {
            const startI = i, startL = line, startC = col;
            adv( c );
            let out = "", closed = false;
            while ( i < n ) {
                const d = input[ i ];
                if ( d === "\\" ) {
                    if ( i + 1 < n ) {
                        const nxt = input[ i + 1 ];
                        out += nxt;
                        adv( d ); adv( nxt );
                        continue;
                    } else {
                        adv( d ); break;
                    }
                }
                if ( d === '"' ) { adv( d ); closed = true; break; }
                out += d; adv( d );
            }
            // si no cierra, igualmente emitimos lo que tengamos
            push( { k: "STR", v: out, i: startI, line: startL, col: startC } );
            continue;
        }

        // symbols
        if ( "{}(),;".includes( c ) ) {
            const startL = line, startC = col;
            push( { k: "SYM", v: c as any, i, line: startL, col: startC } );
            adv( c );
            continue;
        }

        // numbers (UIKEY)
        if ( isDigit( c ) ) {
            const startI = i, startL = line, startC = col;
            let out = c; adv( c );
            while ( i < n && isDigit( input[ i ] ) ) { out += input[ i ]; adv( input[ i ] ); }
            // NUM o KW (UI etc.)? por diseño, números no son keywords
            push( { k: "NUM", v: out, i: startI, line: startL, col: startC } );
            continue;
        }

        // identifiers/keywords (solo letras minúsculas/mayúsculas)
        if ( /[A-Za-z_]/.test( c ) ) {
            const startI = i, startL = line, startC = col;
            let out = c; adv( c );
            while ( i < n && /[A-Za-z_]/.test( input[ i ] ) ) { out += input[ i ]; adv( input[ i ] ); }
            if ( KEYWORDS.has( out ) ) push( { k: "KW", v: out, i: startI, line: startL, col: startC } );
            else push( { k: "KW", v: out, i: startI, line: startL, col: startC } ); // tratamos todo como KW para simplicidad
            // NOTA: solo usamos palabras esperadas; las demás caerán como "KW" desconocida y se ignorarán en parser
            continue;
        }

        // cualquier otro char: ignóralo para ser tolerantes
        adv( c );
    }

    return tks;
}
