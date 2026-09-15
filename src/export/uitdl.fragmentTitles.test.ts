import { describe, expect, it } from "vitest";
import { buildFragmentGroups } from "../fragments/fragmentModel";
import type { AppState } from "../state/types";
import { exportToUITDL, exportToUITDLWithLocations } from "./uitdl";

describe( "exportToUITDL fragment titles", () => {
    it( "locates transition conditions on the guard segment", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "Form",
                    displayId: "1",
                },
                {
                    id: 2,
                    x: 300,
                    y: 100,
                    title: "Saved",
                    displayId: "2",
                },
            ],
            actions: [
                {
                    id: 10,
                    originNodeId: 1,
                    x: 180,
                    y: 100,
                    verb: "clicks",
                    complement: "Save",
                    title: 'clicks "Save"',
                },
            ],
            conditions: [
                {
                    id: 20,
                    originActionId: 10,
                    x: 240,
                    y: 100,
                    title: "valid data",
                },
            ],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 1 },
                    to: { kind: "action", id: 10 },
                    style: "solid",
                },
                {
                    id: 2,
                    from: { kind: "action", id: 10 },
                    to: { kind: "condition", id: 20 },
                    style: "dashed2",
                },
                {
                    id: 3,
                    from: { kind: "condition", id: 20 },
                    to: { kind: "node", id: 2 },
                    style: "dashed1",
                },
            ],
            fragmentTitles: {},
        } as unknown as AppState;

        const exported = exportToUITDLWithLocations( state );
        const actionLocation = exported.locations.actions.get( 10 )?.[ 0 ];
        const conditionLocation = exported.locations.conditions.get( 20 )?.[ 0 ];

        expect( actionLocation ).toBeDefined();
        expect( conditionLocation ).toBeDefined();

        const transitionLine = exported.text.split( "\n" )[ conditionLocation!.lineNumber - 1 ];

        expect(
            transitionLine.slice( actionLocation!.column - 1, actionLocation!.endColumn - 1 )
        ).toBe( 'clicks "Save"' );
        expect(
            transitionLine.slice( conditionLocation!.column - 1, conditionLocation!.endColumn - 1 )
        ).toBe( 'AND "valid data"' );
    } );

    it( "locates nested DRAW node references and fragment declarations", () => {
        const state = {
            nodes: [
                {
                    id: 2,
                    x: 100,
                    y: 100,
                    title: "Container",
                    displayId: "2",
                },
                {
                    id: 1,
                    x: 120,
                    y: 120,
                    title: "Child",
                    displayId: "1",
                    parentId: 2,
                },
            ],
            actions: [
                {
                    id: 10,
                    originNodeId: 1,
                    x: 220,
                    y: 140,
                    verb: "clicks",
                    complement: "Save",
                    title: 'clicks "Save"',
                },
            ],
            conditions: [],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 1 },
                    to: { kind: "action", id: 10 },
                    style: "solid",
                },
            ],
            fragmentTitles: {},
        } as unknown as AppState;

        const exported = exportToUITDLWithLocations( state );
        const parentLocation = exported.locations.nodes.get( 2 )?.[ 0 ];
        const childLocation = exported.locations.nodes.get( 1 )?.[ 0 ];
        const fragmentLocation = exported.locations.fragments[ 0 ];

        expect( parentLocation ).toBeDefined();
        expect( childLocation ).toBeDefined();
        expect( fragmentLocation ).toBeDefined();

        const lines = exported.text.split( "\n" );
        const drawLine = lines[ childLocation!.lineNumber - 1 ];
        const fragmentLine = lines[ fragmentLocation.lineNumber - 1 ];

        expect(
            drawLine.slice( parentLocation!.column - 1, parentLocation!.endColumn - 1 )
        ).toBe( "2" );
        expect(
            drawLine.slice( childLocation!.column - 1, childLocation!.endColumn - 1 )
        ).toBe( "1" );
        expect(
            fragmentLine.slice( fragmentLocation.column - 1, fragmentLocation.endColumn - 1 )
        ).toMatch( /^FRAGMENT "/ );
    } );

    it( "uses edited fragment titles in FRAGMENT declarations", () => {
        const base = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "Login",
                    displayId: "1",
                },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
        } as unknown as AppState;

        const fragment = buildFragmentGroups( base )[ 0 ];
        const state = {
            ...base,
            fragmentTitles: {
                [ fragment.id ]: "Login flow",
            },
        } as unknown as AppState;

        const uitd = exportToUITDL( state );

        expect( uitd ).toContain( 'FRAGMENT "Login flow"' );
    } );

    it( "recovers stale fragment titles when current fragment membership still overlaps clearly", () => {
        const state = {
            nodes: [
                {
                    id: 2,
                    x: 100,
                    y: 100,
                    title: "Courses",
                    displayId: "2",
                },
                {
                    id: 3,
                    x: 130,
                    y: 140,
                    title: "Rubrics",
                    displayId: "3",
                    parentId: 2,
                },
            ],
            actions: [
                {
                    id: 5,
                    originNodeId: 2,
                    x: 160,
                    y: 100,
                    verb: "clicks",
                    complement: "Courses",
                    title: 'clicks "Courses"',
                },
            ],
            conditions: [],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 2 },
                    to: { kind: "action", id: 5 },
                    style: "solid",
                },
            ],
            fragmentTitles: {
                "action:5|node:1|node:2": "Course management",
            },
        } as unknown as AppState;

        const currentFragment = buildFragmentGroups( state )[ 0 ];

        expect( state.fragmentTitles[ currentFragment.id ] ).toBeUndefined();

        const uitd = exportToUITDL( state );

        expect( uitd ).toContain( 'FRAGMENT "Course management"' );
    } );

    it( "keeps a title when a named single-node fragment expands through a new transition", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "Existing screen",
                    displayId: "1",
                },
                {
                    id: 2,
                    x: 260,
                    y: 100,
                    title: "New screen",
                    displayId: "2",
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 2,
                    x: 220,
                    y: 100,
                    verb: "clicks",
                    complement: "Continue",
                    title: 'clicks "Continue"',
                },
            ],
            conditions: [],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 2 },
                    to: { kind: "action", id: 1 },
                    style: "solid",
                },
                {
                    id: 2,
                    from: { kind: "action", id: 1 },
                    to: { kind: "node", id: 1 },
                    style: "dashed1",
                },
            ],
            fragmentTitles: {
                "node:1": "Named flow",
            },
        } as unknown as AppState;

        const currentFragment = buildFragmentGroups( state )[ 0 ];

        expect( state.fragmentTitles[ currentFragment.id ] ).toBeUndefined();

        const uitd = exportToUITDL( state );

        expect( uitd ).toContain( 'FRAGMENT "Named flow"' );
        expect( uitd ).not.toContain( 'FRAGMENT "Fragment 1"' );
    } );

    it( "keeps the larger prior title when a transition merges two named fragments", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "Large A",
                    displayId: "1",
                },
                {
                    id: 2,
                    x: 120,
                    y: 140,
                    title: "Large B",
                    displayId: "2",
                    parentId: 1,
                },
                {
                    id: 3,
                    x: 320,
                    y: 100,
                    title: "Small",
                    displayId: "3",
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 180,
                    y: 100,
                    verb: "clicks",
                    complement: "Open",
                    title: 'clicks "Open"',
                },
                {
                    id: 2,
                    originNodeId: 3,
                    x: 260,
                    y: 100,
                    verb: "clicks",
                    complement: "Back",
                    title: 'clicks "Back"',
                },
            ],
            conditions: [],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 1 },
                    to: { kind: "action", id: 1 },
                    style: "solid",
                },
                {
                    id: 2,
                    from: { kind: "node", id: 3 },
                    to: { kind: "action", id: 2 },
                    style: "solid",
                },
                {
                    id: 3,
                    from: { kind: "action", id: 2 },
                    to: { kind: "node", id: 1 },
                    style: "dashed1",
                },
            ],
            fragmentTitles: {
                "action:1|node:1|node:2": "Large flow",
                "action:2|node:3": "Small flow",
            },
        } as unknown as AppState;

        const currentFragment = buildFragmentGroups( state )[ 0 ];

        expect( state.fragmentTitles[ currentFragment.id ] ).toBeUndefined();

        const uitd = exportToUITDL( state );

        expect( uitd ).toContain( 'FRAGMENT "Large flow"' );
        expect( uitd ).not.toContain( 'FRAGMENT "Fragment 1"' );
    } );

    it( "keeps a prior title when two equal-sized named fragments merge", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "First",
                    displayId: "1",
                },
                {
                    id: 2,
                    x: 300,
                    y: 100,
                    title: "Second",
                    displayId: "2",
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 180,
                    y: 100,
                    verb: "clicks",
                    complement: "Next",
                    title: 'clicks "Next"',
                },
                {
                    id: 2,
                    originNodeId: 2,
                    x: 260,
                    y: 100,
                    verb: "clicks",
                    complement: "Back",
                    title: 'clicks "Back"',
                },
            ],
            conditions: [],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 1 },
                    to: { kind: "action", id: 1 },
                    style: "solid",
                },
                {
                    id: 2,
                    from: { kind: "node", id: 2 },
                    to: { kind: "action", id: 2 },
                    style: "solid",
                },
                {
                    id: 3,
                    from: { kind: "action", id: 1 },
                    to: { kind: "node", id: 2 },
                    style: "dashed1",
                },
            ],
            fragmentTitles: {
                "action:1|node:1": "First flow",
                "action:2|node:2": "Second flow",
            },
        } as unknown as AppState;

        const currentFragment = buildFragmentGroups( state )[ 0 ];

        expect( state.fragmentTitles[ currentFragment.id ] ).toBeUndefined();

        const uitd = exportToUITDL( state );

        expect( uitd ).toContain( 'FRAGMENT "First flow"' );
        expect( uitd ).not.toContain( 'FRAGMENT "Fragment 1"' );
    } );
} );
