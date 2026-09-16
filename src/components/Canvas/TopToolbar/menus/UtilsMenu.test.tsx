// src/components/Canvas/TopToolbar/menus/UtilsMenu.test.tsx
// Verifies conditional visibility for uniform color-mode controls.

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UtilsMenu } from "./UtilsMenu";
import { useAppStore } from "../../../../state/store";

function setColorModeForTest( colorMode: "random" | "uniform" ) {
    useAppStore.setState( {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        selection: new Set(),
        selectionActions: new Set(),
        selectionConds: new Set(),
        isCanvasLockedByUITDLLiveSync: false,
        colorMode,
        uniformColorKey: "blue",
        uniformTone: "light",
        uniformIncludesActions: false,
        uniformIncludesConditions: false,
    } );
}

describe( "UtilsMenu color mode controls", () => {
    afterEach( () => {
        setColorModeForTest( "random" );
    } );

    it( "hides uniform color options while uniform mode is off", () => {
        setColorModeForTest( "random" );

        render( <UtilsMenu /> );

        expect( screen.getByRole( "checkbox", { name: "Uniform UI color" } ) ).not.toBeNull();
        expect( screen.queryByRole( "combobox", { name: "Uniform UI color" } ) ).toBeNull();
        expect( screen.queryByRole( "combobox", { name: "Uniform UI tone" } ) ).toBeNull();
        expect( screen.queryByRole( "checkbox", { name: "Apply to actions" } ) ).toBeNull();
        expect( screen.queryByRole( "checkbox", { name: "Apply to conditions" } ) ).toBeNull();
    } );

    it( "shows uniform color options while uniform mode is on", () => {
        setColorModeForTest( "uniform" );

        render( <UtilsMenu /> );

        expect( screen.getByRole( "combobox", { name: "Uniform UI color" } ) ).not.toBeNull();
        expect( screen.getByRole( "combobox", { name: "Uniform UI tone" } ) ).not.toBeNull();
        expect( screen.getByRole( "checkbox", { name: "Apply to actions" } ) ).not.toBeNull();
        expect( screen.getByRole( "checkbox", { name: "Apply to conditions" } ) ).not.toBeNull();
    } );
} );
