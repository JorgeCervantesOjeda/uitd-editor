// src/components/Canvas/RigidBlocksLayer.test.tsx
// Verifies visible RigidBlock geometry, non-interaction, and notices.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RigidBlockNotice } from "./RigidBlockNotice";
import { RigidBlocksLayer } from "./RigidBlocksLayer";
import { buildRigidBlockBounds } from "../../rigidBlocks/rigidBlockModel";

const { state, useAppStore } = vi.hoisted( () => {
    const state = {
        canvasDark: false,
        rigidBlocks: [ { id: 4, members: [ { kind: "node" as const, id: 1 } ] } ],
        nodes: [ { id: 1, x: 50, y: 60, title: "Node", w: 40, h: 30, parentId: null } ],
        actions: [],
        conditions: [],
        rigidBlockNotice: {
            kind: "error" as const,
            code: "multiple-fragments" as const,
            message: "A rigid block can contain elements from only one fragment.",
        },
        dismissRigidBlockNotice: vi.fn(),
    };
    const useAppStore = ( selector: ( value: typeof state ) => unknown ) => selector( state );
    return { state, useAppStore };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

describe( "RigidBlock canvas rendering", () => {
    it( "rendersRoundedRigidBlockBounds", () => {
        render(
            <svg>
                <RigidBlocksLayer />
            </svg>
        );

        const bounds = buildRigidBlockBounds( {
            members: state.rigidBlocks[ 0 ].members,
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
        } );
        const rect = screen.getByTestId( "rigid-block-4" );
        expect( rect.getAttribute( "rx" ) ).toBe( "12" );
        expect( rect.getAttribute( "x" ) ).toBe( String( bounds!.left ) );
        expect( rect.getAttribute( "y" ) ).toBe( String( bounds!.top ) );
    } );

    it( "usesTheSameCenterAndAreaAsPhysicsGeometry", () => {
        render( <svg><RigidBlocksLayer /></svg> );

        const bounds = buildRigidBlockBounds( {
            members: state.rigidBlocks[ 0 ].members,
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
        } );
        const rect = screen.getByTestId( "rigid-block-4" );
        expect( rect.getAttribute( "width" ) ).toBe( String( bounds!.width ) );
        expect( rect.getAttribute( "height" ) ).toBe( String( bounds!.height ) );
        expect( rect.getAttribute( "data-center-x" ) ).toBe( String( bounds!.center.x ) );
        expect( rect.getAttribute( "data-center-y" ) ).toBe( String( bounds!.center.y ) );
    } );

    it( "doesNotCapturePointerEvents", () => {
        render( <svg><RigidBlocksLayer /></svg> );

        expect( screen.getByTestId( "rigid-block-4" ).getAttribute( "pointer-events" ) ).toBe( "none" );
    } );

    it( "rendersDarkModeClass", () => {
        state.canvasDark = true;
        render( <svg><RigidBlocksLayer /></svg> );

        expect( screen.getByTestId( "rigid-block-4" ).classList.contains( "rigidBlockRect--dark" ) ).toBe( true );
        state.canvasDark = false;
    } );

    it( "showsAndDismissesRigidBlockNotice", () => {
        render( <RigidBlockNotice /> );

        expect( screen.getByRole( "status" ).textContent ).toContain( state.rigidBlockNotice.message );
        fireEvent.click( screen.getByRole( "button", { name: "Dismiss" } ) );
        expect( state.dismissRigidBlockNotice ).toHaveBeenCalledTimes( 1 );
    } );
} );
