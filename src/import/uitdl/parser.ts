import { lex, Tok } from "./lexer";
import type { UITDLDoc, UiBlock, UiRef, FragmentAST, TransitionAST, UiActionDecl } from "./types";

export function parseUITDL( src: string ): UITDLDoc {
    const tks = lex( src );
    const p = new Parser( tks );
    return p.parseDoc();
}

class Parser {
    private i = 0;
    constructor ( private tks: Tok[] ) { }

    private peek(): Tok | undefined { return this.tks[ this.i ]; }
    private eat(): Tok | undefined { return this.tks[ this.i++ ]; }
    private is( t: Tok | undefined, k: Tok[ "k" ], v?: string ) {
        if ( !t ) return false;
        if ( t.k !== k ) return false;
        if ( v != null && ( t as any ).v !== v ) return false;
        return true;
    }

    private want( k: Tok[ "k" ], v?: string ): Tok | undefined {
        const t = this.eat();
        if ( !t ) return undefined;
        if ( !this.is( t, k, v ) ) return undefined;
        return t;
    }

    parseDoc(): UITDLDoc {
        // UITD "Title" { ... }
        if ( !this.want( "KW", "UITD" ) ) return this.emptyDoc();
        const titleTok = this.want( "STR" );
        const title = titleTok ? titleTok.v : "UITD";
        if ( !this.want( "SYM", "{" ) ) return { title, uiBlocks: [], fragments: [] };

        const uiBlocks: UiBlock[] = [];
        const fragments: FragmentAST[] = [];

        while ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) {
            const t = this.peek()!;
            if ( this.is( t, "KW", "UI" ) ) {
                const ui = this.parseUIBlock();
                if ( ui ) uiBlocks.push( ui );
            } else if ( this.is( t, "KW", "FRAGMENT" ) ) {
                const fr = this.parseFragment();
                if ( fr ) fragments.push( fr );
            } else {
                this.eat(); // tolerante: ignorar
            }
        }
        this.want( "SYM", "}" );

        return { title, uiBlocks, fragments };
    }

    private parseUIBlock(): UiBlock | undefined {
        this.want( "KW", "UI" );
        const keyTok = this.want( "NUM" ); // UIKEY numérico
        if ( !keyTok ) return undefined;
        let name: string | undefined;
        if ( this.is( this.peek(), "STR" ) ) name = ( this.eat() as any ).v;

        if ( !this.want( "KW", "actions" ) ) return { key: keyTok.v, name, actions: [] };
        if ( !this.want( "SYM", "{" ) ) return { key: keyTok.v, name, actions: [] };

        const actions: UiActionDecl[] = [];
        while ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) {
            const a = this.parseActionDecl();
            if ( a ) actions.push( a );
            // consumir ; tolerante
            if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();
            else if ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) this.eat();
        }
        this.want( "SYM", "}" );
        return { key: keyTok.v, name, actions };
    }

    private parseActionDecl(): UiActionDecl | undefined {
        const verbTok = this.want( "KW" ); // verbo como KW (case sensitive)
        if ( !verbTok ) return undefined;
        const strTok = this.want( "STR" ); // complemento entre comillas
        const verb = verbTok.v.toLowerCase();
        const complement = strTok ? strTok.v : "";
        return { verb, complement, raw: `${verb} ${complement}` };
    }

    private parseFragment(): FragmentAST | undefined {
        this.want( "KW", "FRAGMENT" );
        const nameTok = this.want( "STR" );
        const name = nameTok ? nameTok.v : "Fragment";
        if ( !this.want( "SYM", "{" ) ) return { name, draw: [], transitions: [] };

        // DRAW { ... };
        if ( !this.want( "KW", "DRAW" ) ) return { name, draw: [], transitions: [] };
        if ( !this.want( "SYM", "{" ) ) return { name, draw: [], transitions: [] };

        const draw: UiRef[] = [];
        const first = this.parseUiRef(); if ( first ) draw.push( first );
        while ( this.is( this.peek(), "SYM", "," ) ) {
            this.eat();
            const r = this.parseUiRef(); if ( r ) draw.push( r );
        }
        this.want( "SYM", "}" );
        // ; opcionalmente
        if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();

        // TRANSITION*
        const transitions: TransitionAST[] = [];
        while ( this.is( this.peek(), "KW", "TRANSITION" ) ) {
            const tr = this.parseTransition();
            if ( tr ) transitions.push( tr );
        }

        this.want( "SYM", "}" );
        return { name, draw, transitions };
    }

    private parseUiRef(): UiRef | undefined {
        const keyTok = this.want( "NUM" );
        if ( !keyTok ) return undefined;
        const children: UiRef[] = [];
        if ( this.is( this.peek(), "SYM", "(" ) ) {
            this.eat(); // (
            const first = this.parseUiRef(); if ( first ) children.push( first );
            while ( this.is( this.peek(), "SYM", "," ) ) { this.eat(); const ch = this.parseUiRef(); if ( ch ) children.push( ch ); }
            this.want( "SYM", ")" );
        }
        return { key: keyTok.v, children };
    }

    private parseTransition(): TransitionAST | undefined {
        this.want( "KW", "TRANSITION" );
        if ( !this.want( "KW", "from" ) ) return undefined;
        const from = this.parseUiRef();
        if ( !this.want( "KW", "to" ) ) return undefined;
        const to = this.parseUiRef();
        if ( !this.want( "KW", "if" ) ) return undefined;
        if ( !this.want( "KW", "user" ) ) return undefined;

        const act = this.parseActionDecl();
        if ( !act ) return undefined;

        let condLabel: string | undefined;
        if ( this.is( this.peek(), "KW", "AND" ) ) {
            this.eat();
            const s = this.want( "STR" );
            condLabel = s ? s.v : undefined;
        }
        if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();

        return {
            from: from || { key: "", children: [] },
            to: to || { key: "", children: [] },
            actionRaw: act.raw,            // ya normalizado: verb minúsculas, complemento sin comillas
            condLabel
        };
    }

    private emptyDoc(): UITDLDoc {
        return { title: "UITD", uiBlocks: [], fragments: [] };
    }
}
