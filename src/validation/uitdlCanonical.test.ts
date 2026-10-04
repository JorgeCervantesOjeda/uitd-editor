// src/validation/uitdlCanonical.test.ts
// Verifies the project-owned UITDL validator's shared fragment-name contract.

import { describe, expect, it } from "vitest";
import { parseUITDL } from "./uitdlCanonical";

describe( "project-owned UITDL validator", () => {
    it( "rejects duplicate fragment names with an error marker", () => {
        const parsed = parseUITDL( `UITD "Duplicate fragments" {
    UI 1 "Home" actions {}
    FRAGMENT "Flow" {
        DRAW { 1 };
    }
    FRAGMENT "Flow" {
        DRAW { 1 };
    }
}` );

        expect( parsed.errors ).toEqual( expect.arrayContaining( [
            expect.objectContaining( {
                severity: 8,
                code: "duplicate-fragment-name",
                message: 'Duplicate fragment name: "Flow".',
            } ),
        ] ) );
    } );

    it( "keeps fragment names case-sensitive", () => {
        const parsed = parseUITDL( `UITD "Case-sensitive fragments" {
    UI 1 "Home" actions {}
    FRAGMENT "Flow" {
        DRAW { 1 };
    }
    FRAGMENT "flow" {
        DRAW { 1 };
    }
}` );

        expect( parsed.errors ).not.toEqual( expect.arrayContaining( [
            expect.objectContaining( { code: "duplicate-fragment-name" } ),
        ] ) );
    } );
} );
