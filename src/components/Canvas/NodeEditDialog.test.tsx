// src/components/Canvas/NodeEditDialog.test.tsx
// Verifies node metadata editing feedback and validation.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";
import { NodeEditDialog } from "./NodeEditDialog";

describe( "NodeEditDialog", () => {
    afterEach( () => {
        useAppStore.setState( {
            nodes: [],
            actions: [],
            conditions: [],
            edges: [],
        } );
        localStorage.clear();
    } );

    it( "rejects display IDs with leading zeros before updating the canvas state", () => {
        useAppStore.setState( {
            nodes: [
                {
                    id: 1,
                    displayId: "1",
                    title: "Start",
                    x: 0,
                    y: 0,
                    w: 120,
                    h: 80,
                    parentId: null,
                },
            ],
            actions: [],
            conditions: [],
            edges: [],
        } );

        render( <NodeEditDialog open={ true } nodeId={ 1 } onClose={ vi.fn() } /> );

        const input = screen.getByLabelText( "Display ID" ) as HTMLInputElement;
        fireEvent.change( input, { target: { value: "01" } } );

        expect( screen.getByText( "Invalid UIID \"01\": UI IDs must not contain leading zeros." ) ).toBeTruthy();
        expect( useAppStore.getState().nodes.find( node => node.id === 1 )?.displayId ).toBe( "1" );

        fireEvent.blur( input );

        expect( input.value ).toBe( "1" );
    } );

    it( "opens new node color controls with the same colors rendered by the canvas", () => {
        const canvasFill = "#f1f5f9";
        const canvasStroke = "#94a3b8";

        useAppStore.setState( {
            nodes: [
                {
                    id: 1,
                    displayId: "1",
                    title: "Node 1",
                    x: 0,
                    y: 0,
                    w: 120,
                    h: 80,
                    wrap: 22,
                    colorFill: canvasFill,
                    colorStroke: canvasStroke,
                    colorText: "#334155",
                    parentId: null,
                },
            ],
            actions: [],
            conditions: [],
            edges: [],
        } );

        const { container } = render( <NodeEditDialog open={ true } nodeId={ 1 } onClose={ vi.fn() } /> );
        const colorInputs = Array.from( container.querySelectorAll<HTMLInputElement>( 'input[type="color"]' ) );

        expect( colorInputs[ 0 ].value ).toBe( canvasFill );
        expect( colorInputs[ 1 ].value ).toBe( canvasStroke );
    } );
} );
