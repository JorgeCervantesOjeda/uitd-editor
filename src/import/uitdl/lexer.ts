// src/import/uitdl/lexer.ts

export type TokenKind =
    | "KW"
    | "ID"
    | "NUMBER"
    | "STR"
    | "LBRACE"
    | "RBRACE"
    | "LPAREN"
    | "RPAREN"
    | "COMMA"
    | "SEMI"
    | "EOF";

export interface Token {
    kind: TokenKind;
    value?: string;
    line: number;
    col: number;
}

type LexError = Error & { line: number; col: number };

const KEYWORDS = new Set( [
    "UITD",
    "UI",
    "actions",
    "FRAGMENT",
    "DRAW",
    "TRANSITION",
    "from",
    "to",
    "if",
    "user",
    "AND",
    "WIDTH",
] );

export class Lexer {
    private text: string;
    private pos = 0;
    private line = 1;
    private col = 1;

    constructor ( text: string ) {
        this.text = text ?? "";
    }

    private peek(): string {
        return this.text[ this.pos ] ?? "";
    }

    private next(): string {
        const ch = this.text[ this.pos++ ] ?? "";
        if ( ch === "\n" ) {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        return ch;
    }

    private isWS( ch: string ): boolean {
        return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
    }

    private isDigit( ch: string ): boolean {
        return ch >= "0" && ch <= "9";
    }

    private isIdStart( ch: string ): boolean {
        return /[A-Za-z_]/.test( ch );
    }

    private isIdPart( ch: string ): boolean {
        return /[A-Za-z0-9_]/.test( ch );
    }

    public nextToken(): Token {
        // skip whitespace
        while ( this.isWS( this.peek() ) ) this.next();

        const line = this.line;
        const col = this.col;
        const ch = this.peek();

        if ( !ch ) {
            return { kind: "EOF", line, col };
        }

        // comments: '#' until end of line
        if ( ch === "#" ) {
            while ( this.peek() && this.peek() !== "\n" ) this.next();
            return this.nextToken();
        }

        // punctuation
        if ( ch === "{" ) {
            this.next();
            return { kind: "LBRACE", line, col };
        }
        if ( ch === "}" ) {
            this.next();
            return { kind: "RBRACE", line, col };
        }
        if ( ch === "(" ) {
            this.next();
            return { kind: "LPAREN", line, col };
        }
        if ( ch === ")" ) {
            this.next();
            return { kind: "RPAREN", line, col };
        }
        if ( ch === "," ) {
            this.next();
            return { kind: "COMMA", line, col };
        }
        if ( ch === ";" ) {
            this.next();
            return { kind: "SEMI", line, col };
        }

        // string literal
        if ( ch === '"' ) {
            this.next(); // consume opening quote
            let val = "";

            while ( true ) {
                const c = this.peek();
                if ( !c ) {
                    throw this.lexError(
                        line,
                        col,
                        "Unterminated string literal. Missing closing '\"'."
                    );
                }
                if ( c === '"' ) {
                    this.next(); // consume closing quote
                    break;
                }
                if ( c === "\n" ) {
                    // ❌ Rule: no newlines inside QUOTEDSTRING
                    throw this.lexError(
                        this.line,
                        this.col,
                        "Newlines are not allowed inside quoted strings."
                    );
                }
                val += this.next();
            }

            return { kind: "STR", value: val, line, col };
        }

        // number
        if ( this.isDigit( ch ) ) {
            let num = "";
            while ( this.isDigit( this.peek() ) ) {
                num += this.next();
            }
            return { kind: "NUMBER", value: num, line, col };
        }

        // identifier / keyword
        if ( this.isIdStart( ch ) ) {
            let id = "";
            while ( this.isIdPart( this.peek() ) ) {
                id += this.next();
            }
            if ( KEYWORDS.has( id ) ) {
                return { kind: "KW", value: id, line, col };
            }
            return { kind: "ID", value: id, line, col };
        }

        // unknown character
        throw this.lexError(
            line,
            col,
            `Unexpected character '${ch}'.`
        );
    }

    private lexError( line: number, col: number, msg: string ): Error {
        const e = new Error( `LEX ERROR at L${line}:C${col}: ${msg}` ) as LexError;
        e.line = line;
        e.col = col;
        return e;
    }
}
