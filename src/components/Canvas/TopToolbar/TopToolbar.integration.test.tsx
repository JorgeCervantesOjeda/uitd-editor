// src/components/Canvas/TopToolbar/TopToolbar.integration.test.tsx
// Verifies exclusive toolbar surfaces and persistent validation visibility.
// The matching full user-flow check is scripts/_verify-validation-disabled-during-target-selection.mjs.

import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopToolbar } from "./index";

function renderToolbar() {
    const onOpenTransientSurface = vi.fn();
    function ToolbarHarness() {
        const svgRef = useRef<SVGSVGElement | null>( null );
        const [ diagOpen, setDiagOpen ] = useState( true );
        const [ validationInteractionsDisabled, setValidationInteractionsDisabled ] = useState( false );
        return (
            <>
                <button
                    type="button"
                    onClick={ () => setValidationInteractionsDisabled( value => !value ) }
                >
                    Toggle target selection
                </button>
                <TopToolbar
                    svgRef={ svgRef }
                    diagOpen={ diagOpen }
                    validationInteractionsDisabled={ validationInteractionsDisabled }
                    onToggleDiag={ () => setDiagOpen( value => !value ) }
                    onOpenTransientSurface={ onOpenTransientSurface }
                />
            </>
        );
    }

    render( <ToolbarHarness /> );
    return onOpenTransientSurface;
}

describe( "TopToolbar transient surfaces", () => {
    it( "keeps only the latest toolbar menu open when Alt shortcuts switch menus", () => {
        renderToolbar();

        fireEvent.keyDown( document, { key: "f", altKey: true } );
        expect( screen.getByRole( "menu", { name: "File" } ) ).not.toBeNull();

        fireEvent.keyDown( document, { key: "e", altKey: true } );
        expect( screen.queryByRole( "menu", { name: "File" } ) ).toBeNull();
        expect( screen.getByRole( "menu", { name: "Edit" } ) ).not.toBeNull();
    } );

    it( "switches exclusively between a menu, Help, and AI review", () => {
        renderToolbar();

        fireEvent.keyDown( document, { key: "f", altKey: true } );
        fireEvent.keyDown( document, { key: "h", altKey: true } );
        expect( screen.queryByRole( "menu", { name: "File" } ) ).toBeNull();
        expect( screen.getByRole( "dialog", { name: "Help" } ) ).not.toBeNull();

        fireEvent.keyDown( document, { key: "i", altKey: true } );
        expect( screen.queryByRole( "dialog", { name: "Help" } ) ).toBeNull();
        expect( screen.getByRole( "region", { name: "AI diagram review" } ) ).not.toBeNull();

        fireEvent.keyDown( document, { key: "x", altKey: true } );
        expect( screen.queryByRole( "region", { name: "AI diagram review" } ) ).toBeNull();
        expect( screen.getByRole( "menu", { name: "Export" } ) ).not.toBeNull();
    } );

    it( "keeps Validation open until its button is clicked", () => {
        renderToolbar();

        const validationButton = screen.getByRole( "button", { name: /Validation/ } );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();

        fireEvent.keyDown( document, { key: "Escape" } );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();
        fireEvent.keyDown( document, { key: "v", altKey: true } );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();
        fireEvent.keyDown( document, { key: "f", altKey: true } );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();

        fireEvent.click( validationButton );
        expect( screen.queryByRole( "region", { name: "Validation issues" } ) ).toBeNull();
        fireEvent.keyDown( document, { key: "v", altKey: true } );
        expect( screen.queryByRole( "region", { name: "Validation issues" } ) ).toBeNull();
        fireEvent.click( validationButton );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();
    } );

    it( "disables Validation interactions during target selection and restores them afterward", () => {
        renderToolbar();

        const validationButton = screen.getByRole( "button", { name: /Validation/ } );
        const panel = screen.getByRole( "region", { name: "Validation issues" } );
        expect( ( validationButton as HTMLButtonElement ).disabled ).toBe( false );

        fireEvent.click( screen.getByRole( "button", { name: "Toggle target selection" } ) );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).toBe( panel );
        expect( ( validationButton as HTMLButtonElement ).disabled ).toBe( true );

        fireEvent.click( screen.getByRole( "button", { name: "Toggle target selection" } ) );
        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).toBe( panel );
        expect( ( validationButton as HTMLButtonElement ).disabled ).toBe( false );
    } );

    it( "requests closing canvas context menus before opening transient surfaces", () => {
        const onOpenTransientSurface = renderToolbar();

        fireEvent.keyDown( document, { key: "f", altKey: true } );
        expect( onOpenTransientSurface ).toHaveBeenCalledTimes( 1 );

        fireEvent.keyDown( document, { key: "h", altKey: true } );
        expect( onOpenTransientSurface ).toHaveBeenCalledTimes( 2 );

        fireEvent.keyDown( document, { key: "i", altKey: true } );
        expect( onOpenTransientSurface ).toHaveBeenCalledTimes( 3 );
    } );

    it( "dismisses AI review on an outside pointer press", () => {
        renderToolbar();

        fireEvent.keyDown( document, { key: "i", altKey: true } );
        const review = screen.getByRole( "region", { name: "AI diagram review" } );
        fireEvent.pointerDown( review );
        expect( screen.getByRole( "region", { name: "AI diagram review" } ) ).not.toBeNull();

        fireEvent.pointerDown( document.body );
        expect( screen.queryByRole( "region", { name: "AI diagram review" } ) ).toBeNull();
    } );
} );
