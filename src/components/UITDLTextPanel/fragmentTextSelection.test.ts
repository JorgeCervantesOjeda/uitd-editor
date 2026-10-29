// src/components/UITDLTextPanel/fragmentTextSelection.test.ts
// Links fragment identity cases to real reconciliation and grid-compaction integration.

import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileUITDLTextIncrementally } from "../../import/uitdl/incremental";
import { useAppStore } from "../../state/store";
import { resolveFragmentTextSelection } from "./fragmentTextSelection";

const initialState = useAppStore.getState();
const project = {
    nodes: [
        { id: 1, displayId: "1", title: "First", x: 600, y: 400 },
        { id: 20, displayId: "2", title: "Second", x: 100, y: 100 },
    ],
    actions: [], conditions: [], edges: [],
    fragmentTitles: { "node:1": "First", "node:20": "Second" },
};

describe( "fragment text identity (linked to the panel FRAGMENT click regression)", () => {
    afterEach( () => useAppStore.setState( initialState, true ) );

    it.each( [
        { name: "Second", draw: "2", expected: [ 20 ] },
        { name: "First", draw: "1", expected: [ 1 ] },
        { name: "Unknown", draw: "2", expected: [ 20 ] },
        { name: "Second {title}", draw: "2", expected: [ 20 ] },
    ] )( "resolves $name independently of canvas order", ( { name, draw, expected } ) => {
        vi.spyOn( console, "info" ).mockImplementation( () => undefined );
        const lines = [ `FRAGMENT ${JSON.stringify( name )} {`, `DRAW { ${draw} };`, "}" ];
        expect( resolveFragmentTextSelection( lines, 1, project )?.nodes ).toEqual( new Set( expected ) );
    } );

    it( "disambiguates equal titles using containment instead of root UIID alone", () => {
        const nested = {
            ...project,
            nodes: [
                ...project.nodes.map( node => ( { ...node, displayId: "1" } ) ),
                { id: 21, displayId: "3", title: "Child", x: 100, y: 100, parentId: 20 },
            ],
            fragmentTitles: { "node:1": "Same", "node:20|node:21": "Same" },
        };
        vi.spyOn( console, "info" ).mockImplementation( () => undefined );
        expect( resolveFragmentTextSelection( [ 'FRAGMENT "Same" { DRAW { 1[3] }; }' ], 1, nested )?.nodes )
            .toEqual( new Set( [ 20, 21 ] ) );
    } );

    it( "does not choose an arbitrary group for indistinguishable fragments", () => {
        const log = vi.spyOn( console, "info" ).mockImplementation( () => undefined );
        const ambiguous = {
            ...project,
            nodes: project.nodes.map( node => ( { ...node, displayId: "1" } ) ),
            fragmentTitles: { "node:1": "Same", "node:20": "Same" },
        };
        expect( resolveFragmentTextSelection( [ 'FRAGMENT "Same" { DRAW { 1 }; }' ], 1, ambiguous ) ).toBeNull();
        expect( log ).toHaveBeenCalledWith( expect.any( String ), expect.objectContaining( {
            fallback: "Keeping the current canvas selection.",
        } ) );
    } );

    it( "keeps selection unchanged for a non-fragment line", () => {
        expect( resolveFragmentTextSelection( [ "DRAW { 1 };" ], 1, project ) ).toBeNull();
    } );

    it( "preserves the text-to-group identity after real incremental application and grid compaction", () => {
        // Integration link: the same input order is exercised by the panel click and browser system checks.
        const text = `UITD "Reordered" {
            UI 1 "First" actions { clicks "First"; }
            UI 2 "Second" actions { clicks "Second"; }
            FRAGMENT "Second" {
                DRAW { 2 };
                TRANSITION from 2 to 2 if user clicks "Second";
            }
            FRAGMENT "First" {
                DRAW { 1 };
                TRANSITION from 1 to 1 if user clicks "First";
            }
        }`;
        vi.spyOn( console, "info" ).mockImplementation( () => undefined );
        const result = reconcileUITDLTextIncrementally( text, { ...initialState, ...project } );
        useAppStore.setState( { ...result, isCanvasLockedByUITDLLiveSync: false } );
        const before = useAppStore.getState().nodes.map( node => ( { ...node } ) );
        useAppStore.getState().compactFragmentsToGrid( { captureHistory: false } );
        const current = useAppStore.getState();
        expect( current.nodes.some( node => {
            const prior = before.find( candidate => candidate.id === node.id )!;
            return node.x !== prior.x || node.y !== prior.y;
        } ) ).toBe( true );
        const selected = resolveFragmentTextSelection( text.split( "\n" ), 4, current );
        expect( selected?.nodes ).toEqual( new Set( [ 20 ] ) );
        expect( selected?.actions.size ).toBe( 1 );
        expect( current.actions.find( action => selected?.actions.has( action.id ) )?.originNodeId ).toBe( 20 );
    } );
} );
