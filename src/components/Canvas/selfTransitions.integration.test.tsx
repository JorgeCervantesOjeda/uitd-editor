// src/components/Canvas/selfTransitions.integration.test.tsx
// Links edge geometry tests to the UITDL import, canvas rendering, and export flow.
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseUITDL } from "../../import/uitdl/parser";
import { buildProjectFromAST } from "../../import/uitdl/build";
import { useAppStore } from "../../state/store";
import { serializeSvg } from "../../utils/exportsvg";
import { EdgesLayer } from "./edges";

const initialState = useAppStore.getState();
afterEach( () => useAppStore.setState( initialState, true ) );

describe( "same-UI transition rendering", () => {
    it.each( [ false, true ] )( "separates an unconditional return in the canvas and exported SVG (dark=%s)", dark => {
        const project = buildProjectFromAST( parseUITDL( `
            UITD "Refresh" {
                UI 1 "Dashboard" actions { clicks "Refresh"; }
                FRAGMENT "Refresh in place" {
                    DRAW { 1 };
                    TRANSITION from 1 to 1 if user clicks "Refresh";
                }
            }
        ` ), initialState );
        expect( project.conditions ).toHaveLength( 0 );
        expect( project.edges ).toHaveLength( 2 );
        const node = project.nodes[ 0 ];
        const action = project.actions[ 0 ];
        useAppStore.setState( {
            nodes: [ { ...node, x: 0, y: 0 } ], actions: [ { ...action, x: 200, y: 0 } ],
            conditions: [], edges: project.edges, canvasDark: dark, pendingConnect: null,
            selection: new Set(), selectionActions: new Set(), selectionConds: new Set(),
        } );
        const returnEdge = project.edges.find( edge => edge.from.kind === "action" )!;
        // Render an override containing only the return edge, as layered canvases can do.
        const { container } = render( <svg><EdgesLayer edgesOverride={ [ returnEdge ] } /></svg> );
        const path = container.querySelector( "[data-edge-id] > path" )!;
        expect( path.getAttribute( "d" ) ).toBe( "M 200 0 Q 150 -36 100 -36 Q 50 -36 0 0" );
        act( () => useAppStore.setState( { selection: new Set( [ node.id ] ), selectionActions: new Set( [ action.id ] ) } ) );
        const highlight = container.querySelector( '[data-edge-id] > path[data-export="ignore"]' )!;
        expect( highlight.getAttribute( "d" ) ).toBe( path.getAttribute( "d" ) );
        const exported = new DOMParser().parseFromString( serializeSvg( container.querySelector( "svg" )! ), "image/svg+xml" );
        expect( exported.querySelector( "parsererror" ) ).toBeNull();
        expect( exported.querySelector( "[data-edge-id] > path" )?.getAttribute( "d" ) ).toBe( path.getAttribute( "d" ) );
        expect( exported.querySelector( '[data-export="ignore"]' ) ).toBeNull();
    } );

    it( "keeps conditional returns and transitions to another UI straight", () => {
        const project = buildProjectFromAST( parseUITDL( `
            UITD "Navigation" {
                UI 1 "Dashboard" actions { clicks "Refresh"; clicks "Open"; }
                UI 2 "Details" actions {}
                FRAGMENT "Navigation" {
                    DRAW { 1, 2 };
                    TRANSITION from 1 to 1 if user clicks "Refresh" AND "data is ready";
                    TRANSITION from 1 to 2 if user clicks "Open";
                }
            }
        ` ), initialState );
        expect( project.conditions ).toHaveLength( 1 );
        useAppStore.setState( {
            ...project, selection: new Set(), selectionActions: new Set(), selectionConds: new Set(), pendingConnect: null,
        } );
        const { container } = render( <svg><EdgesLayer /></svg> );
        const paths = container.querySelectorAll( "[data-edge-id] > path" );
        expect( paths ).toHaveLength( project.edges.length );
        paths.forEach( path => expect( path.getAttribute( "d" ) ).not.toMatch( /[QC]/ ) );
    } );
} );
