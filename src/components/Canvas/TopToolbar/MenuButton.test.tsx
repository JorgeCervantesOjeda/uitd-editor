// Verifies that portaled controls do not close their owning toolbar menu.

import { createPortal } from "react-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MenuButton } from "./MenuButton";

function PortaledControl( { marked }: { marked: boolean } ) {
    return createPortal(
        <button type="button" data-menu-portal={ marked ? "true" : undefined }>
            Portaled control
        </button>,
        document.body
    );
}

describe( "MenuButton outside pointer handling", () => {
    it( "keeps the menu open when a marked portal control receives a pointerdown", () => {
        render(
            <MenuButton title="Export" icon={ null }>
                <PortaledControl marked />
            </MenuButton>
        );

        fireEvent.click( screen.getByRole( "button", { name: "Export" } ) );
        fireEvent.pointerDown( screen.getByRole( "button", { name: "Portaled control" } ) );

        expect( screen.getByRole( "menu", { name: "Export" } ) ).not.toBeNull();
    } );

    it( "closes the menu for an unrelated outside pointerdown", () => {
        render(
            <>
            <MenuButton title="Export" icon={ null }>
                    <span>Menu content</span>
                </MenuButton>
                <button type="button">Outside control</button>
            </>
        );

        fireEvent.click( screen.getByRole( "button", { name: "Export" } ) );
        fireEvent.pointerDown( screen.getByRole( "button", { name: "Outside control" } ) );

        expect( screen.queryByRole( "menu", { name: "Export" } ) ).toBeNull();
    } );
} );
