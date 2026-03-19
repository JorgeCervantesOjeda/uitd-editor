// src/import/uitdl/parser.ts
import { Lexer, Token } from "./lexer";
import { isUiVerb } from "../../model/uiVerbs";
import type {
    UITDLDoc,
    ParseIssue,
    UiBlock,
    UiActionDecl,
    UiRef,
    FragmentAST,
    TransitionAST,
} from "./types";

export function parseUITDL( text: string ): UITDLDoc {
    const lex = new Lexer( text );
    let tok: Token = lex.nextToken();
    const issues: ParseIssue[] = [];

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

    const parseUiKey = (): string => {
        let key = "";
        if ( tok.kind === "NUMBER" || tok.kind === "ID" ) {
            key = tok.value!;
            next();
        } else {
            error( `Expected UI reference id but found ${tok.kind}` );
        }
        return key;
    };

    const parseDrawRef = (): UiRef => {
        const key = parseUiKey();
        let children: UiRef[] = [];

        if ( tok.kind === "LBRACK" ) {
            next();
            children = parseDrawRefChildren();
            expect( "RBRACK" );
        } else if ( tok.kind === "LPAREN" ) {
            // Legacy containment syntax in DRAW.
            next();
            children = parseDrawRefChildren();
            expect( "RPAREN" );
        }

        return { key, children };
    };

    const parseDrawRefChildren = (): UiRef[] => {
        const children: UiRef[] = [];
        children.push( parseDrawRef() );
        while ( tok.kind === "COMMA" ) {
            next();
            children.push( parseDrawRef() );
        }
        return children;
    };

    const parseTransitionRef = (): UiRef => {
        const key = parseUiKey();
        let children: UiRef[] = [];

        if ( tok.kind === "LPAREN" ) {
            next();
            children = [ parseTransitionRef() ];
            expect( "RPAREN" );
        }

        return { key, children };
    };

    const parseActions = (): UiActionDecl[] => {
        const acts: UiActionDecl[] = [];
        expectKW( "actions" );
        expect( "LBRACE" );

        while ( tok.kind !== "RBRACE" && tok.kind !== "EOF" ) {
            const rawVerb = tok.value ?? "";
            if ( !isUiVerb( rawVerb ) ) {
                error( `Invalid UITDL verb '${rawVerb}' in actions block.` );
            }
            const verb = ( isUiVerb( rawVerb ) ? rawVerb : "clicks" ) as UiActionDecl[ "verb" ];
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
        const from = parseTransitionRef();
        expectKW( "to" );
        const to = parseTransitionRef();
        expectKW( "if" );
        expectKW( "user" );

        const rawVerb = tok.value ?? "";
        if ( !isUiVerb( rawVerb ) ) {
            error( `Invalid UITDL verb '${rawVerb}' in transition.` );
        }
        const verb = ( isUiVerb( rawVerb ) ? rawVerb : "clicks" ) as TransitionAST[ "verb" ];
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
        draw.push( parseDrawRef() );
        while ( tok.kind === "COMMA" ) {
            next();
            draw.push( parseDrawRef() );
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
