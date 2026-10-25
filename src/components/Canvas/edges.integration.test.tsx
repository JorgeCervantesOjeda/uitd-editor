// src/components/Canvas/edges.integration.test.tsx
// Checks selection rendering against the real store and SVG export serialization.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/store";
import { serializeSvg } from "../../utils/exportsvg";
import { EdgesLayer } from "./edges";
import type { EdgeEndpoint } from "../../model/types";

const initialState = useAppStore.getState();

describe( "edge selection and export", () => {
    beforeEach( () => useAppStore.setState( {
        nodes: [ { id: 1, title: "UI", x: 0, y: 0 } ],
        actions: [ { id: 1, originNodeId: 1, title: "Click", verb: "clicks", complement: "Next", x: 100, y: 0 } ],
        conditions: [ { id: 1, originActionId: 1, title: "Ready", x: 200, y: 0 } ],
        selection: new Set(), selectionActions: new Set(), selectionConds: new Set(),
        pendingConnect: null, canvasDark: false,
    } ) );
    afterEach( () => useAppStore.setState( initialState, true ) );

    it.each( [ false, true ] )( "highlights only complete endpoint pairs and excludes the highlight from export (dark=%s)", dark => {
        const endpoints: EdgeEndpoint[] = [ { kind: "node", id: 1 }, { kind: "action", id: 1 }, { kind: "condition", id: 1 } ];
        useAppStore.setState( {
            canvasDark: dark,
            edges: endpoints.map( ( from, index ) => ( { id: index, from, to: endpoints[ ( index + 1 ) % 3 ], style: "solid" } ) ),
        } );
        const { container } = render( <svg><EdgesLayer /></svg> );
        const highlights = () => container.querySelectorAll( '[data-edge-id] > path[data-export="ignore"]' );
        expect( highlights() ).toHaveLength( 0 );
        act( () => useAppStore.setState( { selection: new Set( [ 1 ] ) } ) );
        expect( highlights() ).toHaveLength( 0 );
        act( () => useAppStore.setState( { selectionActions: new Set( [ 1 ] ) } ) );
        expect( highlights() ).toHaveLength( 1 );
        const highlightColor = highlights()[ 0 ].getAttribute( "stroke" );
        expect( highlightColor ).toBe( "var(--diagram-selection)" );
        const markerReference = highlights()[ 0 ].getAttribute( "marker-mid" )!;
        expect( markerReference ).not.toBe( "url(#edgeArrowMid)" );
        const markerId = markerReference.slice( 5, -1 );
        const marker = Array.from( container.querySelectorAll( "marker" ) ).find( element => element.id === markerId );
        expect( marker ).toBeDefined();
        expect( marker!.querySelector( "path" )?.getAttribute( "stroke" ) ).toBe( highlightColor );
        expect( marker!.querySelector( "path" )?.getAttribute( "fill" ) ).toBe( highlightColor );
        act( () => useAppStore.setState( { selectionConds: new Set( [ 1 ] ) } ) );
        expect( highlights() ).toHaveLength( 3 );
        const exported = new DOMParser().parseFromString( serializeSvg( container.querySelector( "svg" )! ), "image/svg+xml" );
        expect( exported.querySelector( "parsererror" )?.textContent ).toBeUndefined();
        expect( exported.querySelectorAll( '[data-export="ignore"]' ) ).toHaveLength( 0 );
        expect( exported.getElementById( markerId ) ).toBeNull();
        expect( exported.querySelectorAll( '[data-edge-id] path' ) ).toHaveLength( 3 );
        exported.querySelectorAll( '[data-edge-id] path' ).forEach( path => {
            expect( path.getAttribute( "stroke" ) ).toBe( dark ? "#e2e8f0" : "#334155" );
            expect( path.getAttribute( "marker-mid" ) ).toBe( "url(#edgeArrowMid)" );
        } );
        expect( highlights() ).toHaveLength( 3 );
        act( () => useAppStore.setState( { selectionActions: new Set() } ) );
        expect( highlights() ).toHaveLength( 1 );
    } );
} );
