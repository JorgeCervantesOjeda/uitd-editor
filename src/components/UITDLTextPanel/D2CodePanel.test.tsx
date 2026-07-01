// src/components/UITDLTextPanel/D2CodePanel.test.tsx
// Verifies canvas color propagation and diagram-prioritized D2 window maximization.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock( "@monaco-editor/react", () => ( {
    default: ( { value }: { value: string } ) => (
        <textarea aria-label="Mock D2 source" value={ value } readOnly />
    ),
} ) );

vi.mock( "../../state/store", () => ( {
    useAppStore: ( selector: ( state: object ) => unknown ) => selector( {
        nodes: [ {
            id: 1,
            displayId: "1",
            colorFill: "#112233",
            colorStroke: "#445566",
            colorText: "#f8fafc",
        } ],
    } ),
} ) );

import { D2CodePanel } from "./D2CodePanel";

const SOURCE = `UITD "Colors" {
    UI 1 "Start" actions { clicks "Finish"; }
    UI 2 "End" actions {}
    FRAGMENT "Flow" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 2 if user clicks "Finish";
    }
}`;

describe( "D2CodePanel", () => {
    it( "embeds canvas colors and maximizes with a restorable state", () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );

        const source = screen.getByRole( "textbox", { name: "Mock D2 source" } ) as HTMLTextAreaElement;
        expect( source.value ).toContain( 'style.fill: "#112233"' );

        fireEvent.click( screen.getByRole( "button", { name: "Maximize D2 window" } ) );

        const dialog = screen.getByRole( "dialog", { name: "D2 source editor" } );
        expect( dialog.classList.contains( "is-maximized" ) ).toBe( true );
        expect( screen.getByRole( "button", { name: "Restore D2 window" } ) ).toBeTruthy();
    } );
} );
