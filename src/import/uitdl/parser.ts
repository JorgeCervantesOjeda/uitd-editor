// src/import/uitdl/parser.ts
import { lex, Tok } from "./lexer";
import type { UITDLDoc, UiBlock, UiRef, FragmentAST, TransitionAST, UiActionDecl, ParseIssue } from "./types";
import type { UiVerb } from "../../model/uiVerbs";
import { validateActionParts } from "../../utils/actionLabel";

export function parseUITDL( src: string ): UITDLDoc {
    const tks = lex( src );
    const p = new Parser( tks );
    const doc = p.parseDoc();
    doc.issues = p.getIssues();
    return doc;
}

class Parser {
    private i = 0;
    private issues: ParseIssue[] = [];

    constructor ( private tks: Tok[] ) { }

    getIssues() { return this.issues; }

    private peek(): Tok | undefined { return this.tks[ this.i ]; }
    private eat(): Tok | undefined { return this.tks[ this.i++ ]; }

    private is( t: Tok | undefined, k: Tok[ "k" ], v?: string ) {
        if ( !t ) return false;
        if ( t.k !== k ) return false;
        if ( v != null && ( t as any ).v !== v ) return false;
        return true;
    }

    private at( t?: Tok ) {
        return { line: t?.line, col: t?.col };
    }

    private issue( kind: "error" | "warning", message: string, t?: Tok ) {
        this.issues.push( { kind, message, ...this.at( t ) } );
    }

    private want( k: Tok[ "k" ], v?: string, ctx?: string ): Tok | undefined {
        const t = this.eat();
        if ( !t ) {
            this.issue( "error", `Unexpected end of input${ctx ? ` while parsing ${ctx}` : ""}.`, undefined );
            return undefined;
        }
        if ( !this.is( t, k, v ) ) {
            const got = `${t.k}${( t as any ).v != null ? `(${( t as any ).v})` : ""}`;
            const exp = `${k}${v != null ? `(${v})` : ""}`;
            this.issue( "error", `Expected ${exp} but got ${got}${ctx ? ` while parsing ${ctx}` : ""}.`, t );
            return undefined;
        }
        return t;
    }

    parseDoc(): UITDLDoc {
        if ( !this.want( "KW", "UITD", "document header (UITD)" ) ) {
            const d = this.emptyDoc();
            this.issue( "error", `Document must start with UITD "Title" { ... }.`, this.peek() );
            return d;
        }

        const titleTok = this.want( "STR", undefined, "document title" );
        const title = titleTok ? titleTok.v : "UITD";

        if ( !this.want( "SYM", "{", "document body" ) ) return { title, uiBlocks: [], fragments: [], issues: this.issues };

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
                this.issue( "warning", `Ignoring unexpected token ${( t as any ).v ?? t.k}.`, t );
                this.eat();
            }
        }

        this.want( "SYM", "}", "document end" );
        return { title, uiBlocks, fragments, issues: this.issues };
    }

    private parseUIBlock(): UiBlock | undefined {
        this.want( "KW", "UI", "UI block" );

        const keyTok = this.want( "NUM", undefined, "UI id" );
        if ( !keyTok ) return undefined;

        let name: string | undefined;
        if ( this.is( this.peek(), "STR" ) ) name = ( this.eat() as any ).v;

        if ( !this.want( "KW", "actions", "UI actions" ) ) return { key: keyTok.v, name, actions: [] };
        if ( !this.want( "SYM", "{", "UI actions body" ) ) return { key: keyTok.v, name, actions: [] };

        const actions: UiActionDecl[] = [];
        while ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) {
            const a = this.parseActionDecl();
            if ( a ) actions.push( a );

            if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();
            else if ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) {
                this.issue( "warning", "Missing ';' after action declaration (tolerated).", this.peek() );
                this.eat();
            }
        }

        this.want( "SYM", "}", "UI actions close" );
        return { key: keyTok.v, name, actions };
    }

    private parseActionDecl(): UiActionDecl | undefined {
        const verbTok = this.want( "KW", undefined, "action verb" );
        if ( !verbTok ) return undefined;

        const strTok = this.want( "STR", undefined, "action complement" );
        const verbRaw = verbTok.v;           // ✅ case sensitive
        const complementRaw = strTok ? strTok.v : "";

        const chk = validateActionParts( verbRaw, complementRaw );
        if ( !chk.ok ) {
            this.issue( "error", chk.reason, strTok ?? verbTok );
            return undefined;
        }

        const verb = chk.verb as UiVerb;
        const complement = chk.complement;

        // raw para compat/debug (sin comillas)
        return { verb, complement, raw: `${verb} ${complement}` };
    }

    private parseFragment(): FragmentAST | undefined {
        this.want( "KW", "FRAGMENT", "fragment header" );

        const nameTok = this.want( "STR", undefined, "fragment name" );
        const name = nameTok ? nameTok.v : "Fragment";

        if ( !this.want( "SYM", "{", "fragment body" ) ) return { name, draw: [], transitions: [] };

        const draw: UiRef[] = [];
        const transitions: TransitionAST[] = [];
        let widthDefault: number | undefined;

        while ( this.peek() && !this.is( this.peek(), "SYM", "}" ) ) {
            const t = this.peek()!;

            // WIDTH <NUM> ;
            if ( this.is( t, "KW", "WIDTH" ) ) {
                this.eat();
                const nTok = this.want( "NUM", undefined, "fragment WIDTH value" );
                if ( nTok ) {
                    const n = parseInt( nTok.v, 10 );
                    if ( Number.isFinite( n ) && n > 0 ) {
                        if ( widthDefault != null && widthDefault !== n ) {
                            this.issue( "warning",
                                `Multiple fragment WIDTH declarations. Keeping first (${widthDefault}), ignoring later (${n}).`,
                                nTok
                            );
                        } else if ( widthDefault == null ) {
                            widthDefault = n;
                        }
                    } else {
                        this.issue( "warning", `Invalid WIDTH value '${nTok.v}', ignoring.`, nTok );
                    }
                }
                if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();
                else this.issue( "warning", "Missing ';' after WIDTH statement (tolerated).", this.peek() );
                continue;
            }

            // DRAW { ... } ;
            if ( this.is( t, "KW", "DRAW" ) ) {
                this.eat();
                if ( !this.want( "SYM", "{", "DRAW body" ) ) break;

                const first = this.parseUiRef(); if ( first ) draw.push( first );
                while ( this.is( this.peek(), "SYM", "," ) ) {
                    this.eat();
                    const r = this.parseUiRef(); if ( r ) draw.push( r );
                }

                this.want( "SYM", "}", "DRAW close" );
                if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();
                else this.issue( "warning", "Missing ';' after DRAW { ... } (tolerated).", this.peek() );
                continue;
            }

            // TRANSITION ...
            if ( this.is( t, "KW", "TRANSITION" ) ) {
                const tr = this.parseTransition();
                if ( tr ) transitions.push( tr );
                continue;
            }

            this.issue( "warning", `Ignoring unexpected token ${( t as any ).v ?? t.k} inside FRAGMENT.`, t );
            this.eat();
        }

        this.want( "SYM", "}", "fragment close" );

        if ( draw.length === 0 ) {
            this.issue( "warning", `FRAGMENT "${name}" has no DRAW statements.`, nameTok );
        }

        return { name, draw, transitions, widthDefault };
    }

    private parseUiRef(): UiRef | undefined {
        const keyTok = this.want( "NUM", undefined, "UI reference id" );
        if ( !keyTok ) return undefined;

        const children: UiRef[] = [];
        if ( this.is( this.peek(), "SYM", "(" ) ) {
            this.eat();
            const first = this.parseUiRef(); if ( first ) children.push( first );
            while ( this.is( this.peek(), "SYM", "," ) ) {
                this.eat();
                const ch = this.parseUiRef(); if ( ch ) children.push( ch );
            }
            this.want( "SYM", ")", "UI reference close ')'" );
        }

        return { key: keyTok.v, children };
    }

    private parseTransition(): TransitionAST | undefined {
        this.want( "KW", "TRANSITION", "transition" );
        if ( !this.want( "KW", "from", "transition FROM" ) ) return undefined;

        const from = this.parseUiRef();

        if ( !this.want( "KW", "to", "transition TO" ) ) return undefined;

        const to = this.parseUiRef();

        if ( !this.want( "KW", "if", "transition IF" ) ) return undefined;
        if ( !this.want( "KW", "user", "transition USER" ) ) return undefined;

        const act = this.parseActionDecl();
        if ( !act ) return undefined;

        let condLabel: string | undefined;
        if ( this.is( this.peek(), "KW", "AND" ) ) {
            this.eat();
            const s = this.want( "STR", undefined, "transition condition label" );
            condLabel = s ? s.v : undefined;
        }

        // Optional: WIDTH <NUM>
        let width: number | undefined;
        if ( this.is( this.peek(), "KW", "WIDTH" ) ) {
            this.eat();
            const wnTok = this.want( "NUM", undefined, "transition WIDTH value" );
            if ( wnTok ) {
                const n = parseInt( wnTok.v, 10 );
                if ( Number.isFinite( n ) && n > 0 ) width = n;
                else this.issue( "warning", `Invalid WIDTH value '${wnTok.v}', ignoring.`, wnTok );
            }
        }

        if ( this.is( this.peek(), "SYM", ";" ) ) this.eat();
        else this.issue( "warning", "Missing ';' after TRANSITION ... (tolerated).", this.peek() );

        return {
            from: from || { key: "", children: [] },
            to: to || { key: "", children: [] },

            verb: act.verb,
            complement: act.complement,

            actionRaw: act.raw, // compat/debug
            condLabel,
            width,
        };
    }

    private emptyDoc(): UITDLDoc {
        return { title: "UITD", uiBlocks: [], fragments: [], issues: this.issues };
    }
}
