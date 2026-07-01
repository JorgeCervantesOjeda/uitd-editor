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
        expect( d2 ).toContain( 'ui_2.ui_1 -> ui_3: "clicks \\"Home\\" AND\\n\\"session active\\""' );
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

        expect( d2 ).toContain( 'ui_1 -> ui_2: "clicks\\n\\"Open\\ndetails\\""' );
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
