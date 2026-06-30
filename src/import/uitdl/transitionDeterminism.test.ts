// Verifies deterministic action branching in textual UITDL models.

import { describe, expect, it } from "vitest";
import { validateTransitionDeterminism } from "./transitionDeterminism";

function modelWithTransitions( transitions: string ): string {
    return `UITD "Determinism" {
        UI 1 "Origin" actions { clicks "Continue"; }
        UI 2 "First" actions {}
        UI 3 "Second" actions {}
        FRAGMENT "Flow" {
            DRAW { 1, 2, 3 };
            ${transitions}
        }
    }`;
}

describe( "validateTransitionDeterminism", () => {
    it( "rejects an action that mixes conditional and unconditional transitions", () => {
        const issues = validateTransitionDeterminism( modelWithTransitions( `
            TRANSITION from 1 to 2 if user clicks "Continue";
            TRANSITION from 1 to 3 if user clicks "Continue" AND "alternative";
        ` ) );

        expect( issues.some( issue => issue.message.includes( "mixes conditional and unconditional" ) ) ).toBe( true );
    } );

    it( "rejects different destinations for the same condition", () => {
        const issues = validateTransitionDeterminism( modelWithTransitions( `
            TRANSITION from 1 to 2 if user clicks "Continue" AND "allowed";
            TRANSITION from 1 to 3 if user clicks "Continue" AND "allowed";
        ` ) );

        expect( issues.some( issue => issue.message.includes( "multiple destinations" ) ) ).toBe( true );
    } );

    it( "allows distinct conditions and exact repetitions across fragments", () => {
        const text = modelWithTransitions( `
            TRANSITION from 1 to 2 if user clicks "Continue" AND "first";
            TRANSITION from 1 to 3 if user clicks "Continue" AND "second";
        ` ).replace( "    }", `
        FRAGMENT "Repeated view" {
            DRAW { 1, 2 };
            TRANSITION from 1 to 2 if user clicks "Continue" AND "first";
        }
    }` );

        expect( validateTransitionDeterminism( text ) ).toEqual( [] );
    } );
} );
