// src/validation/sharedUITDLRules.test.ts
// Verifies source-independent UITDL rules consumed by text and canvas adapters.

import { describe, expect, it } from "vitest";
import {
    analyzeTransitionSet,
    duplicateCaseSensitiveValues,
    hasLeadingZeroUIID,
    normalizeComparableText,
    isPositiveInteger,
} from "./sharedUITDLRules.js";

describe( "shared UITDL rules", () => {
    it( "detects duplicate names without folding case", () => {
        expect( duplicateCaseSensitiveValues( [ "Flow", "flow", "Flow" ] ) ).toEqual( [
            { value: "Flow", index: 2, firstIndex: 0 },
        ] );
    } );

    it( "shares UIID and positive-width rules", () => {
        expect( hasLeadingZeroUIID( "01" ) ).toBe( true );
        expect( hasLeadingZeroUIID( "1" ) ).toBe( false );
        expect( isPositiveInteger( 1 ) ).toBe( true );
        expect( isPositiveInteger( 0 ) ).toBe( false );
    } );

    it( "analyzes transition determinism after shared text normalization", () => {
        const analysis = analyzeTransitionSet( [
            { scope: "fragment-a", from: "1", to: "2", verb: "clicks", complement: "Continue", condition: " Ready " },
            { scope: "fragment-a", from: "1", to: "3", verb: "clicks", complement: "Continue", condition: "ready" },
            { scope: "fragment-b", from: "1", to: "2", verb: "clicks", complement: "Continue", condition: null },
            { scope: "fragment-c", from: "1", to: "2", verb: "clicks", complement: "Continue", condition: "ready" },
        ] );

        expect( normalizeComparableText( " Ready " ) ).toBe( "ready" );
        expect( analysis.multipleDestinationGroups ).toEqual( [
            expect.objectContaining( { condition: "ready", indices: [ 0, 1, 3 ] } ),
        ] );
        expect( analysis.mixedActionGroups ).toEqual( [
            expect.objectContaining( { indices: [ 0, 1, 2, 3 ] } ),
        ] );
        expect( analysis.duplicateIndices ).toEqual( [] );
    } );
} );
