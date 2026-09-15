// src/App.test.tsx
// Verifies collapse and accessible keyboard resizing for the UITDL editor sidebar.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock( "./components/Canvas/Canvas", () => ( {
    default: () => <div aria-label="Mock canvas" />,
} ) );

vi.mock( "./components/UITDLTextPanel/UITDLTextPanel", () => ( {
    UITDLTextPanel: ( { onCollapse }: { onCollapse: () => void } ) => (
        <aside aria-label="UITDL text editor">
            <button type="button" onClick={ onCollapse }>Collapse editor</button>
        </aside>
    ),
} ) );

import App from "./App";

describe( "App UITDL sidebar", () => {
    it( "collapses toward the left and expands without recreating the sidebar", () => {
        render( <App /> );

        fireEvent.click( screen.getByRole( "button", { name: "Collapse editor" } ) );
        const expandButton = screen.getByRole( "button", { name: "Expand UITDL text editor" } );
        expect( expandButton.getAttribute( "aria-expanded" ) ).toBe( "false" );

        fireEvent.click( expandButton );
        expect( screen.getByRole( "separator", { name: "Resize UITDL text editor" } ) ).toBeTruthy();
    } );

    it( "resizes the expanded sidebar with the keyboard", () => {
        render( <App /> );
        const separator = screen.getByRole( "separator", { name: "Resize UITDL text editor" } );

        expect( separator.getAttribute( "aria-valuenow" ) ).toBe( "640" );
        fireEvent.keyDown( separator, { key: "ArrowRight" } );
        expect( separator.getAttribute( "aria-valuenow" ) ).toBe( "660" );
    } );
} );
