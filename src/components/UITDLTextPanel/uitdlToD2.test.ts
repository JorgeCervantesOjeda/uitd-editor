// src/components/UITDLTextPanel/uitdlToD2.test.ts
// @vitest-environment node
// Verifies D2 translation of hierarchy, contained references, guards, and WIDTH.

import { describe, expect, it } from "vitest";
import { D2 } from "@terrastruct/d2";
import { translateUITDLToD2 } from "./uitdlToD2";

describe( "translateUITDLToD2", () => {
    it( "preserves fragment hierarchy and contained transition references", () => {
        const source = `UITD "Portal" {
            UI 1 "Menu" actions { clicks "Home"; }
            UI 2 "Dashboard" actions {}
            UI 3 "Home" actions {}
            FRAGMENT "Navigation" {
                WIDTH 18;
                DRAW { 2[1], 3 };
                TRANSITION from 2(1) to 3 if user clicks "Home" AND "session active";
            }
        }`;

        const d2 = translateUITDLToD2( source );

        expect( d2 ).toContain( 'fragment_1: "Navigation" {' );
        expect( d2 ).toContain( 'ui_2: "2 Dashboard" {' );
        expect( d2 ).toContain( 'action_1: "clicks \\"Home\\""' );
        expect( d2 ).toContain( 'condition_1: "session active"' );
        expect( d2 ).toContain( "ui_2.ui_1 -> action_1" );
        expect( d2 ).toContain( "action_1 -> condition_1" );
        expect( d2 ).toContain( "condition_1 -> ui_3" );
    } );

    it( "applies transition WIDTH instead of the fragment default", () => {
        const source = `UITD "Override" {
            UI 1 "Start" actions { clicks "Open details"; }
            UI 2 "End" actions {}
            FRAGMENT "Flow" {
                WIDTH 40;
                DRAW { 1, 2 };
                TRANSITION from 1 to 2 if user clicks "Open details" WIDTH 8;
            }
        }`;

        const d2 = translateUITDLToD2( source );

        expect( d2 ).toContain( 'action_1: "clicks\\n\\"Open\\ndetails\\""' );
        expect( d2 ).toContain( "ui_1 -> action_1" );
        expect( d2 ).toContain( "action_1 -> ui_2" );
    } );

    it( "reuses one action node for conditional transitions from the same origin", async () => {
        const source = `UITD "Conditional action" {
            UI 1 "Diagnóstico" actions { clicks "volver"; }
            UI 2 "Inicio" actions {}
            UI 3 "Resumen" actions {}
            FRAGMENT "Volver" {
                DRAW { 1, 2, 3 };
                TRANSITION from 1 to 2 if user clicks "volver" AND "estaba en diagnóstico";
                TRANSITION from 1 to 3 if user clicks "volver" AND "estaba en resumen";
            }
        }`;

        const d2 = translateUITDLToD2( source );

        expect( d2.match( /action_[0-9]+: "clicks \\"volver\\""/g ) ).toHaveLength( 1 );
        expect( d2 ).toContain( "action_1: \"clicks \\\"volver\\\"\" {\n      shape: text\n    }" );
        expect( d2 ).toContain( "condition_1: \"estaba en diagnóstico\" {\n      shape: hexagon\n    }" );
        expect( d2 ).not.toContain( "shape: rectangle" );
        expect( d2 ).not.toContain( "shape: oval" );
        expect( d2 ).toContain( 'condition_1: "estaba en diagnóstico"' );
        expect( d2 ).toContain( 'condition_2: "estaba en resumen"' );
        expect( d2 ).toContain( "ui_1 -> action_1" );
        expect( d2 ).toContain( "action_1 -> condition_1" );
        expect( d2 ).toContain( "action_1 -> condition_2" );
        expect( d2 ).toContain( "condition_1 -> ui_2" );
        expect( d2 ).toContain( "condition_2 -> ui_3" );

        const compiler = new D2();
        const { diagram, renderOptions } = await compiler.compile( d2, { layout: "elk" } );
        const svg = await compiler.render( diagram, renderOptions );

        expect( svg ).toContain( "clicks" );
        expect( svg ).toContain( "volver" );
        expect( svg ).toContain( "estaba en diagnóstico" );
        expect( svg ).toContain( "estaba en resumen" );
    }, 20_000 );

    it( "keeps equal action labels separate when their origin UI is different", () => {
        const source = `UITD "Separate origins" {
            UI 1 "Diagnóstico" actions { clicks "volver"; }
            UI 2 "Detalle" actions { clicks "volver"; }
            UI 3 "Inicio" actions {}
            UI 4 "Resumen" actions {}
            FRAGMENT "Volver" {
                DRAW { 1, 2, 3, 4 };
                TRANSITION from 1 to 3 if user clicks "volver" AND "estaba en diagnóstico";
                TRANSITION from 2 to 4 if user clicks "volver" AND "estaba en detalle";
            }
        }`;

        const d2 = translateUITDLToD2( source );

        expect( d2.match( /action_[0-9]+: "clicks \\"volver\\""/g ) ).toHaveLength( 2 );
        expect( d2 ).toContain( "ui_1 -> action_1" );
        expect( d2 ).toContain( "ui_2 -> action_2" );
    } );

    it( "uses the visual canvas colors for each UIID", () => {
        const source = `UITD "Colors" {
            UI 1 "Start" actions { clicks "Finish"; }
            UI 2 "End" actions {}
            FRAGMENT "Flow" {
                DRAW { 1, 2 };
                TRANSITION from 1 to 2 if user clicks "Finish";
            }
        }`;
        const colorsByUIID = new Map( [
            [ "1", { fill: "#112233", stroke: "#445566", text: "#f8fafc" } ],
        ] );

        const d2 = translateUITDLToD2( source, { colorsByUIID } );

        expect( d2 ).toContain( 'style.fill: "#112233"' );
        expect( d2 ).toContain( 'style.stroke: "#445566"' );
        expect( d2 ).toContain( 'style.font-color: "#f8fafc"' );
        expect( d2 ).toContain( 'style.fill: "#f1f5f9"' );
    } );

    it.each( [ "dagre", "elk" ] as const )( "compiles with the %s layout engine", async layout => {
        const source = `UITD "Compile" {
            UI 1 "Start" actions { clicks "Finish"; }
            UI 2 "End" actions {}
            FRAGMENT "Flow" {
                DRAW { 1, 2 };
                TRANSITION from 1 to 2 if user clicks "Finish";
            }
        }`;
        const d2 = translateUITDLToD2( source );
        const compiler = new D2();

        const { diagram, renderOptions } = await compiler.compile( d2, { layout } );
        const svg = await compiler.render( diagram, renderOptions );

        expect( svg ).toContain( "<svg" );
    }, 20_000 );
} );
