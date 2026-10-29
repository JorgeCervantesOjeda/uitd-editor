// src/components/Canvas/WarningsPanel.interaction.test.tsx
// Verifies Validation controls follow target-selection availability.
// The same behavior is covered across TopToolbar in its integration test and through Canvas in the linked system test.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useAppStore } from "../../state/store";
import { WarningsPanel } from "./WarningsPanel";

afterEach( () => {
    cleanup();
    useAppStore.setState( {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        fragmentTitles: {},
    } );
} );

describe( "WarningsPanel target-selection availability", () => {
    it( "keeps the panel visible but disables its controls while choosing a target", () => {
        useAppStore.setState( {
            nodes: [ { id: 1, displayId: "01", title: "Invalid UI", x: 0, y: 0 } ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
        } );

        render( <WarningsPanel open onToggle={ () => undefined } interactionDisabled /> );

        expect( screen.getByRole( "region", { name: "Validation issues" } ) ).not.toBeNull();
        expect( ( screen.getByRole( "button", { name: /Validation/ } ) as HTMLButtonElement ).disabled ).toBe( true );
        expect( ( screen.getByRole( "button", { name: "Copy list" } ) as HTMLButtonElement ).disabled ).toBe( true );
        expect( ( screen.getByRole( "button", { name: /Invalid UIID/ } ) as HTMLButtonElement ).disabled ).toBe( true );
    } );

    it( "restores actionable validation controls after target selection ends", () => {
        useAppStore.setState( {
            nodes: [ { id: 1, displayId: "01", title: "Invalid UI", x: 0, y: 0 } ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
        } );

        render( <WarningsPanel open onToggle={ () => undefined } interactionDisabled={ false } /> );

        expect( ( screen.getByRole( "button", { name: /Validation/ } ) as HTMLButtonElement ).disabled ).toBe( false );
        expect( ( screen.getByRole( "button", { name: "Copy list" } ) as HTMLButtonElement ).disabled ).toBe( false );
        expect( ( screen.getByRole( "button", { name: /Invalid UIID/ } ) as HTMLButtonElement ).disabled ).toBe( false );
    } );
} );
