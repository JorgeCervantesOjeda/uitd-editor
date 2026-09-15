// src/components/UITDLTextPanel/interactivePreviewModel.test.ts
// Verifies direct navigation, inclusion inheritance, and contained destinations.

import { describe, expect, it } from "vitest";
import {
    buildInteractivePreviewModel,
    effectiveTransitions,
    effectiveUIKeys,
    groupPreviewActions,
    previewActionMode,
} from "./interactivePreviewModel";

const MODEL = `UITD "Navigation" {
    UI 1 "Menu" actions { clicks "Home"; }
    UI 2 "Dashboard" actions { clicks "Details"; }
    UI 3 "Home" actions {}
    UI 4 "Details" actions {}
    FRAGMENT "Menu" {
        DRAW { 1, 3 };
        TRANSITION from 1 to 3 if user clicks "Home";
    }
    FRAGMENT "Dashboard" {
        DRAW { 2[1], 4 };
        TRANSITION from 2 to 4 if user clicks "Details" AND "record exists";
    }
}`;

describe( "interactivePreviewModel", () => {
    it( "includes contained UIs and their outgoing transitions", () => {
        const model = buildInteractivePreviewModel( MODEL );

        expect( [ ...effectiveUIKeys( "2", model.containedKeysByUI ) ] ).toEqual( [ "2", "1" ] );
        expect( effectiveTransitions( model, "2" ).map( transition => transition.toKey ) ).toEqual( [ "3", "4" ] );
    } );

    it( "preserves guards as explicit branch information", () => {
        const model = buildInteractivePreviewModel( MODEL );
        const guardedTransition = effectiveTransitions( model, "2" )
            .find( transition => transition.toKey === "4" );

        expect( guardedTransition?.condition ).toBe( "record exists" );
    } );

    it( "groups transitions as selectable conditions under each action", () => {
        const model = buildInteractivePreviewModel( `UITD "Conditions" {
            UI 1 "Sign in" actions { submits "Credentials"; }
            UI 2 "Home" actions {}
            UI 3 "Error" actions {}
            FRAGMENT "Authentication" {
                DRAW { 1, 2, 3 };
                TRANSITION from 1 to 2 if user submits "Credentials" AND "credentials are valid";
                TRANSITION from 1 to 3 if user submits "Credentials" AND "credentials are invalid";
            }
        }` );

        const actions = groupPreviewActions( effectiveTransitions( model, "1" ) );

        expect( actions ).toHaveLength( 1 );
        expect( actions[ 0 ].transitions.map( transition => transition.condition ) ).toEqual( [
            "credentials are valid",
            "credentials are invalid",
        ] );
        expect( previewActionMode( actions[ 0 ] ) ).toBe( "conditional" );
    } );

    it( "classifies one direct transition as an immediately navigable action", () => {
        const model = buildInteractivePreviewModel( MODEL );
        const action = groupPreviewActions( effectiveTransitions( model, "1" ) )[ 0 ];

        expect( previewActionMode( action ) ).toBe( "unconditional" );
    } );
} );
