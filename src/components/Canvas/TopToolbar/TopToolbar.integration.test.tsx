// src/components/Canvas/TopToolbar/TopToolbar.integration.test.tsx
// Verifies exclusive toolbar surfaces and persistent validation visibility.

import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopToolbar } from "./index";

function renderToolbar() {
    function ToolbarHarness() {
        const svgRef = useRef<SVGSVGElement | null>( null );
        const [ diagOpen, setDiagOpen ] = useState( true );
        return (
            <TopToolbar
                svgRef={ svgRef }
                diagOpen={ diagOpen }
                onToggleDiag={ () => setDiagOpen( value => !value ) }
            />
        );
    }

    render( <ToolbarHarness /> );
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
} );
