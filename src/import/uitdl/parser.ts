// src/import/uitdl/parser.ts
import { Lexer, Token } from "./lexer";
import type {
    UITDLDoc,
    UiBlock,
    UiActionDecl,
    UiRef,
    FragmentAST,
    TransitionAST,
} from "./types";

export function parseUITDL( text: string ): UITDLDoc {
    const lex = new Lexer( text );
    let tok: Token = lex.nextToken();
    const issues: any[] = [];

    const next = () => ( tok = lex.nextToken() );

    const error = ( msg: string ) => {
        issues.push( {
            kind: "error",
            message: msg,
            line: tok.line,
            col: tok.col,
        } );
    };

    const expect = ( kind: Token[ "kind" ], value?: string ) => {
        if ( tok.kind !== kind || ( value != null && tok.value !== value ) ) {
            error(
                `Expected ${value ?? kind} but found ${tok.value ?? tok.kind}`
            );
            return false;
        }
        next();
        return true;
    };

    const expectKW = ( v: string ) => expect( "KW", v );

    const parseNumber = (): number => {
        const v = tok.value;
        expect( "NUMBER" );
        return Number( v );
    };

    const parseString = (): string => {
        const v = tok.value ?? "";
        expect( "STR" );
        return v;
    };

    const parseUiRef = (): UiRef => {
        let key = "";
        if ( tok.kind === "NUMBER" || tok.kind === "ID" ) {
            key = tok.value!;
            next();
        } else {
            error( `Expected UI reference id but found ${tok.kind}` );
        }

        let children: UiRef[] = [];
        if ( tok.kind === "LPAREN" ) {
            next(); // consume "("
            children = parseUiRefChildren();
        }

        return { key, children };
    };

    // Helper separado para evitar el narrowing "LPAREN" vs "COMMA"
    const parseUiRefChildren = (): UiRef[] => {
        const children: UiRef[] = [];
        // ya hemos consumido el "(" en parseUiRef
        children.push( parseUiRef() );
        while ( tok.kind === "COMMA" ) {
            next();
            children.push( parseUiRef() );
        }
        expect( "RPAREN" );
        return children;
    };

    const parseActions = (): UiActionDecl[] => {
        const acts: UiActionDecl[] = [];
        expectKW( "actions" );
        expect( "LBRACE" );

        while ( tok.kind !== "RBRACE" && tok.kind !== "EOF" ) {
            const verb = tok.value as UiActionDecl[ "verb" ]; // UiVerb
            expect( "ID" );
            const comp = parseString();
            expect( "SEMI" );
            const raw = `${verb} ${comp}`; // sin comillas, como en TransitionAST.actionRaw
            acts.push( { verb, complement: comp, raw } );
        }

        expect( "RBRACE" );
        return acts;
    };

    const parseUI = (): UiBlock => {
        expectKW( "UI" );
        const id = tok.value!;
        expect( "NUMBER" );
        const name = parseString();
        const actions = parseActions();
        return { key: id, name, actions };
    };

    const parseTransition = (): TransitionAST => {
        expectKW( "TRANSITION" );
        expectKW( "from" );
        const from = parseUiRef();
        expectKW( "to" );
        const to = parseUiRef();
        expectKW( "if" );
        expectKW( "user" );

        const verb = tok.value as TransitionAST[ "verb" ]; // UiVerb
        expect( "ID" );
        const complement = parseString();
        const actionRaw = `${verb} ${complement}`; // sin comillas

        let condLabel: string | undefined;
        if ( tok.kind === "KW" && tok.value === "AND" ) {
            next();
            condLabel = parseString();
        }

        let width: number | undefined;
        if ( tok.kind === "KW" && tok.value === "WIDTH" ) {
            next();
            width = parseNumber();
        }

        expect( "SEMI" );
        return { from, to, verb, complement, actionRaw, condLabel, width };
    };

    // Helper para DRAW { ... } que evita narrowing "KW" vs "COMMA"
    const parseDrawInto = ( draw: UiRef[] ) => {
        // se llama justo cuando hemos visto KW DRAW
        next(); // consume "DRAW"
        expect( "LBRACE" );
        draw.push( parseUiRef() );
        while ( tok.kind === "COMMA" ) {
            next();
            draw.push( parseUiRef() );
        }
        expect( "RBRACE" );
        expect( "SEMI" );
    };

    const parseFragment = (): FragmentAST => {
        expectKW( "FRAGMENT" );
        const name = parseString();
        expect( "LBRACE" );

        let widthDefault: number | undefined;
        const draw: UiRef[] = [];
        const transitions: TransitionAST[] = [];

        while ( tok.kind !== "RBRACE" && tok.kind !== "EOF" ) {
            if ( tok.kind === "KW" && tok.value === "WIDTH" ) {
                next();
                widthDefault = parseNumber();
                expect( "SEMI" );
            } else if ( tok.kind === "KW" && tok.value === "DRAW" ) {
                parseDrawInto( draw );
            } else if ( tok.kind === "KW" && tok.value === "TRANSITION" ) {
                transitions.push( parseTransition() );
            } else {
                error(
                    `Unexpected token in FRAGMENT: ${tok.kind} ${tok.value ?? ""}`
                );
                next();
            }
        }

        expect( "RBRACE" );
        return { name, draw, transitions, widthDefault };
    };

    // ---- parse document ----
    expectKW( "UITD" );
    const title = parseString();
    expect( "LBRACE" );

    const uiBlocks: UiBlock[] = [];
    const fragments: FragmentAST[] = [];

    while ( tok.kind !== "RBRACE" && tok.kind !== "EOF" ) {
        if ( tok.kind === "KW" && tok.value === "UI" ) {
            uiBlocks.push( parseUI() );
        } else if ( tok.kind === "KW" && tok.value === "FRAGMENT" ) {
            fragments.push( parseFragment() );
        } else {
            error( `Unexpected token: ${tok.kind} ${tok.value ?? ""}` );
            next();
        }
    }

    expect( "RBRACE" );

    return {
        title,
        uiBlocks,
        fragments,
        issues,
    };
}
