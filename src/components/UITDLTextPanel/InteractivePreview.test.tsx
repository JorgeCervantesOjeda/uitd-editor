// src/components/UITDLTextPanel/InteractivePreview.test.tsx
// Verifies nested UI actions, condition selection, and immediate direct navigation.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";
import { InteractivePreview } from "./InteractivePreview";

const MODEL = `UITD "Preview" {
    UI 1 "Navigation" actions { clicks "Home"; }
    UI 2 "Dashboard" actions { clicks "Details"; }
    UI 3 "Home" actions {}
    UI 4 "Detail" actions {}
    FRAGMENT "Navigation" {
        DRAW { 1, 3 };
        TRANSITION from 1 to 3 if user clicks "Home";
    }
    FRAGMENT "Dashboard" {
        DRAW { 2[1], 4 };
        TRANSITION from 2 to 4 if user clicks "Details" AND "record exists";
    }
}`;

describe( "InteractivePreview", () => {
    afterEach( () => {
        useAppStore.setState( { nodes: [], actions: [], conditions: [] } );
    } );

    it( "renders actions inside their current and inserted UIs", () => {
        render( <InteractivePreview text={ MODEL } onClose={ vi.fn() } /> );
        fireEvent.change( screen.getByLabelText( "Current UI" ), { target: { value: "2" } } );

        const currentUI = screen.getByLabelText( "Current UI 2: Dashboard" );
        const insertedUI = screen.getByLabelText( "Inserted UI 1: Navigation" );

        expect( within( currentUI ).getByRole( "button", { name: "clicks “Details” Choose a condition" } ) ).toBeTruthy();
        expect( within( insertedUI ).getByRole( "button", { name: "clicks “Home” Go to UI 3 · Home" } ) ).toBeTruthy();
    } );

    it( "opens a modal even when an action has only one condition", () => {
        render( <InteractivePreview text={ MODEL } onClose={ vi.fn() } /> );
        fireEvent.change( screen.getByLabelText( "Current UI" ), { target: { value: "2" } } );
        fireEvent.click( screen.getByRole( "button", { name: "clicks “Details” Choose a condition" } ) );

        const conditionDialog = screen.getByRole( "dialog", { name: "clicks “Details”" } );
        expect( within( conditionDialog ).getByRole( "button", {
            name: "record exists Go to UI 4 · Detail",
        } ) ).toBeTruthy();
    } );

    it( "navigates immediately from an unconditional inserted action", () => {
        render( <InteractivePreview text={ MODEL } onClose={ vi.fn() } /> );
        fireEvent.change( screen.getByLabelText( "Current UI" ), { target: { value: "2" } } );
        const insertedUI = screen.getByLabelText( "Inserted UI 1: Navigation" );

        fireEvent.click( within( insertedUI ).getByRole( "button", {
            name: "clicks “Home” Go to UI 3 · Home",
        } ) );

        expect( screen.getByLabelText( "Current UI 3: Home" ) ).toBeTruthy();
        expect( screen.queryByText( "Select a condition" ) ).toBeNull();
        const result = screen.getByRole( "status" );
        const currentUI = screen.getByLabelText( "Current UI 3: Home" );
        expect( result.compareDocumentPosition( currentUI ) & Node.DOCUMENT_POSITION_FOLLOWING ).not.toBe( 0 );
    } );

    it( "uses matching canvas colors for UIs, actions, and conditions", () => {
        useAppStore.setState( {
            nodes: [ {
                id: 20,
                displayId: "2",
                title: "Dashboard",
                x: 0,
                y: 0,
                colorFill: "#ffeeaa",
                colorStroke: "#aa6600",
                colorText: "#332200",
            } ],
            actions: [ {
                id: 30,
                originNodeId: 20,
                x: 0,
                y: 0,
                verb: "clicks",
                complement: "Details",
                title: "clicks Details",
                colorFill: "#ddeeff",
                colorStroke: "#225588",
                colorText: "#112233",
            } ],
            conditions: [ {
                id: 40,
                originActionId: 30,
                x: 0,
                y: 0,
                title: "record exists",
                colorFill: "#ddffdd",
                colorStroke: "#228822",
                colorText: "#113311",
            } ],
        } );
        render( <InteractivePreview text={ MODEL } onClose={ vi.fn() } /> );
        fireEvent.change( screen.getByLabelText( "Current UI" ), { target: { value: "2" } } );

        const currentUI = screen.getByLabelText( "Current UI 2: Dashboard" );
        const action = screen.getByRole( "button", { name: "clicks “Details” Choose a condition" } );
        expect( currentUI.style.getPropertyValue( "--preview-ui-fill" ) ).toBe( "#ffeeaa" );
        expect( action.style.getPropertyValue( "--preview-action-fill" ) ).toBe( "#ddeeff" );

        fireEvent.click( action );
        const condition = screen.getByRole( "button", { name: "record exists Go to UI 4 · Detail" } );
        expect( condition.style.getPropertyValue( "--preview-condition-fill" ) ).toBe( "#ddffdd" );
    } );
} );
