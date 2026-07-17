// src/components/UITDLTextPanel/exampleUITDL.test.ts
// Verifies that the bundled learning example remains valid UITDL.

import { describe, expect, it } from "vitest";
import { callOfficialUITDLValidator } from "../../import/uitdl/officialValidatorCaller";
import { EXAMPLE_UITDL } from "./exampleUITDL";
import { buildInteractivePreviewModel, effectiveTransitions } from "./interactivePreviewModel";

describe( "EXAMPLE_UITDL", () => {
    it( "has no validator issues", () => {
        expect( callOfficialUITDLValidator( EXAMPLE_UITDL ) ).toEqual( [] );
    } );

    it( "uses three cohesive fragments instead of one fragment per transition", () => {
        const model = buildInteractivePreviewModel( EXAMPLE_UITDL );
        const countOfFragments = ( EXAMPLE_UITDL.match( /\bFRAGMENT\b/g ) ?? [] ).length;

        expect( countOfFragments ).toBe( 3 );
        expect( model.transitions ).toHaveLength( 11 );
    } );

    it( "reuses navigation in multiple interfaces", () => {
        const model = buildInteractivePreviewModel( EXAMPLE_UITDL );
        const containersWithMenu = [ ...model.containedKeysByUI.entries() ]
            .filter( ( [ , children ] ) => children.has( "1" ) )
            .map( ( [ key ] ) => key );

        expect( containersWithMenu ).toEqual( [ "3", "4", "5", "7" ] );
        expect( effectiveTransitions( model, "3" )
            .some( transition => transition.fromKey === "1" && transition.toKey === "4" ) ).toBe( true );
    } );

    it( "contains mutually exclusive authentication and access guards", () => {
        const model = buildInteractivePreviewModel( EXAMPLE_UITDL );
        const conditions = model.transitions
            .map( transition => transition.condition )
            .filter( Boolean );

        expect( conditions ).toEqual( expect.arrayContaining( [
            "credentials are valid",
            "credentials are invalid",
            "report access is granted",
            "report access is restricted",
        ] ) );
    } );
} );
