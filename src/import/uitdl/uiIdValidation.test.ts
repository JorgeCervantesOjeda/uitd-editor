// src/import/uitdl/uiIdValidation.test.ts
// Verifies UIID leading-zero diagnostics in parsing and visible validation.

import { describe, expect, it } from "vitest";
import { parseUITDL } from "./parser";
import { validateWithOfficialValidator } from "./officialValidator";
import { validateNoLeadingZeroUIIDs } from "./uiIdValidation";

const validModel = `UITD "Valid zero" {
    UI 0 "Placeholder" actions {
        clicks "Go";
    }
    UI 1 "Start" actions {}
    FRAGMENT "Flow" {
        DRAW { 0, 1 };
        TRANSITION from 0 to 1 if user clicks "Go";
    }
}`;

describe( "UIID leading-zero validation", () => {
    it( "allows zero but rejects leading zeros in the internal parser", () => {
        const model = `UITD "Invalid leading zeros" {
            UI 01 "Start" actions {
                clicks "Go";
            }
            UI 2 "End" actions {}
            FRAGMENT "Flow" {
                DRAW { 01, 2 };
                TRANSITION from 01 to 2 if user clicks "Go";
            }
        }`;

        const issues = parseUITDL( model ).issues ?? [];

        expect( issues.filter( issue => issue.message.includes( 'Invalid UIID "01"' ) ) ).toHaveLength( 3 );
    } );

    it( "reports leading-zero UIIDs through visible validation", () => {
        const model = `UITD "Invalid visible validation" {
            UI 1 "Start" actions {
                clicks "Go";
            }
            UI 02 "End" actions {}
            FRAGMENT "Flow" {
                DRAW { 1, 02 };
                TRANSITION from 1 to 02 if user clicks "Go";
            }
        }`;

        const issues = validateWithOfficialValidator( model );

        expect( issues.some( issue => issue.kind === "error" && issue.message.includes( 'Invalid UIID "02"' ) ) )
            .toBe( true );
    } );

    it( "does not report a leading-zero issue for plain zero", () => {
        expect( validateNoLeadingZeroUIIDs( validModel ) ).toEqual( [] );
    } );
} );
