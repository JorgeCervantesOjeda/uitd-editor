// src/components/UITDLTextPanel/uitdlLanguageContext.test.ts
// Verifies tolerant contextual data used by Monaco while UITDL is being authored.

import { describe, expect, it } from "vitest";
import {
    collectFragmentTransitionReferences,
    collectUIContext,
    findCompletionContext,
    innermostUIId,
} from "./uitdlLanguageContext";

const MODEL = `UITD "Context" {
    UI 1 "Navigation" actions { clicks "Home"; clicks "Reports"; }
    UI 2 "Dashboard" actions { submits "Filter"; }
    UI 3 "Home" actions {}
    FRAGMENT "Flow" {
        DRAW { 2[1], 3 };
        TRANSITION from 2(1) to 3 if user clicks "Home";
    }
}`;

describe( "UITDL Monaco context", () => {
    it( "collects UI names and declared actions from incomplete-editor text", () => {
        const contexts = collectUIContext( MODEL );

        expect( contexts[ 0 ] ).toEqual( {
            id: "1",
            name: "Navigation",
            actions: [
                { verb: "clicks", complement: "Home" },
                { verb: "clicks", complement: "Reports" },
            ],
        } );
    } );

    it( "offers standalone and contained references from the current DRAW", () => {
        expect( collectFragmentTransitionReferences( MODEL, 7 ) ).toEqual( [ "2", "3", "2(1)" ] );
        expect( innermostUIId( "2(1)" ) ).toBe( "1" );
    } );

    it( "detects action and complement completion positions", () => {
        const actionLine = "        TRANSITION from 2(1) to 3 if user cli";
        const actionContext = findCompletionContext( MODEL, actionLine, 8, actionLine.length + 1 );
        const complementLine = "        TRANSITION from 2(1) to 3 if user clicks \"Ho";
        const complementContext = findCompletionContext(
            MODEL,
            complementLine,
            8,
            complementLine.length + 1
        );

        expect( actionContext ).toMatchObject( {
            type: "transition-action",
            fromReference: "2(1)",
            prefix: "cli",
        } );
        expect( complementContext ).toMatchObject( {
            type: "transition-complement",
            fromReference: "2(1)",
            verb: "clicks",
            prefix: "Ho",
        } );
    } );

    it( "detects UI reference completion inside a multiline DRAW", () => {
        const text = `FRAGMENT "Flow" {\n    DRAW {\n        12,\n        3\n    };\n}`;

        expect( findCompletionContext( text, "        12,", 3, 11 ) ).toMatchObject( {
            type: "draw-ui",
            prefix: "12",
            startColumn: 9,
        } );
    } );
} );
