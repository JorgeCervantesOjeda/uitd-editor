// src/components/UITDLTextPanel/exampleUITDL.test.ts
// Verifies that the bundled learning example remains valid UITDL.

import { describe, expect, it } from "vitest";
import { validateWithOfficialValidator } from "../../import/uitdl/officialValidator";
import { EXAMPLE_UITDL } from "./exampleUITDL";

describe( "EXAMPLE_UITDL", () => {
    it( "has no validator errors", () => {
        const errors = validateWithOfficialValidator( EXAMPLE_UITDL )
            .filter( issue => issue.kind === "error" );

        expect( errors ).toEqual( [] );
    } );
} );
