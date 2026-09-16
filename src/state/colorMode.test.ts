// src/state/colorMode.test.ts
// Verifies active color-mode assignment for newly created diagram elements.

import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./store";
import {
    DEFAULT_LABEL_FILL,
    DEFAULT_LABEL_STROKE,
    DEFAULT_LABEL_TEXT,
} from "./constants";

function resetStoreForColorModeTest() {
    useAppStore.setState( {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        selection: new Set(),
        selectionActions: new Set(),
        selectionConds: new Set(),
        colorMode: "random",
        uniformColorKey: "blue",
        uniformTone: "light",
        uniformIncludesActions: false,
        uniformIncludesConditions: false,
    } );
}

describe( "color mode creation", () => {
    afterEach( () => {
        vi.restoreAllMocks();
        resetStoreForColorModeTest();
    } );

    it( "creates new UI nodes with deterministic random colors when random mode is active", () => {
        resetStoreForColorModeTest();
        vi.spyOn( Math, "random" )
            .mockReturnValueOnce( 0.2 )
            .mockReturnValueOnce( 0.7 );

        const state = useAppStore.getState();
        state.createNodeAt( 10, 20 );
        state.createNodeAt( 30, 40 );

        expect( useAppStore.getState().nodes.map( node => ( {
            fill: node.colorFill,
            stroke: node.colorStroke,
            text: node.colorText,
        } ) ) ).toEqual( [
            { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" },
            { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
        ] );
    } );

    it( "creates new UI nodes with the selected uniform palette when uniform mode is active", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( {
            colorMode: "uniform",
            uniformColorKey: "violet",
            uniformTone: "dark",
        } );

        useAppStore.getState().createNodeAt( 10, 20 );

        expect( useAppStore.getState().nodes[ 0 ] ).toMatchObject( {
            colorFill: "#4c1d95",
            colorStroke: "#ddd6fe",
            colorText: "#f5f3ff",
        } );
    } );

    it( "keeps action creation behavior unless uniform action coloring is enabled", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( {
            colorMode: "uniform",
            uniformColorKey: "blue",
            uniformTone: "light",
            uniformIncludesActions: false,
            nodes: [
                {
                    id: 1,
                    displayId: "1",
                    title: "Start",
                    x: 0,
                    y: 0,
                    w: 120,
                    h: 80,
                    colorFill: "#abcabc",
                    colorStroke: "#123456",
                    colorText: "#111111",
                    parentId: null,
                },
            ],
            nextActionId: 1,
            nextEdgeId: 1,
        } );

        useAppStore.getState().addActionForNode( 1 );

        expect( useAppStore.getState().actions[ 0 ] ).toMatchObject( {
            colorFill: "#abcabc",
            colorStroke: "#123456",
            colorText: "#111111",
        } );

        useAppStore.setState( {
            actions: [],
            edges: [],
            nextActionId: 1,
            nextEdgeId: 1,
            uniformIncludesActions: true,
        } );

        useAppStore.getState().addActionForNode( 1 );

        expect( useAppStore.getState().actions[ 0 ] ).toMatchObject( {
            colorFill: "#eff6ff",
            colorStroke: "#3b82f6",
            colorText: "#172554",
        } );
    } );

    it( "keeps condition creation behavior unless uniform condition coloring is enabled", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( {
            colorMode: "uniform",
            uniformColorKey: "blue",
            uniformTone: "light",
            uniformIncludesConditions: false,
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 0,
                    y: 0,
                    verb: "clicks",
                    complement: "X",
                    title: 'clicks "X"',
                    colorFill: "#eff6ff",
                    colorStroke: "#3b82f6",
                    colorText: "#172554",
                },
            ],
            nextId: 1,
            nextEdgeId: 1,
        } );

        useAppStore.getState().handleCreateCondition( 1 );

        expect( useAppStore.getState().conditions[ 0 ] ).toMatchObject( {
            colorFill: DEFAULT_LABEL_FILL,
            colorStroke: DEFAULT_LABEL_STROKE,
            colorText: DEFAULT_LABEL_TEXT,
        } );

        useAppStore.setState( {
            conditions: [],
            edges: [],
            nextId: 1,
            nextEdgeId: 1,
            uniformIncludesConditions: true,
        } );

        useAppStore.getState().handleCreateCondition( 1 );

        expect( useAppStore.getState().conditions[ 0 ] ).toMatchObject( {
            colorFill: "#f8fafc",
            colorStroke: "#60a5fa",
            colorText: "#172554",
        } );
    } );

    it( "establishes random mode when an invalid color mode reaches the store", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( { colorMode: "invalid" as "random" } );

        useAppStore.getState().normalizeColorModeSettings();

        expect( useAppStore.getState().colorMode ).toBe( "random" );
    } );

    it( "resets conditions to the normal label colors when recoloring all in random mode", () => {
        resetStoreForColorModeTest();
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
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                    parentId: null,
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 0,
                    y: 0,
                    verb: "clicks",
                    complement: "Submit",
                    title: 'clicks "Submit"',
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                },
            ],
            conditions: [
                {
                    id: 1,
                    originActionId: 1,
                    title: "is enabled",
                    x: 0,
                    y: 0,
                    wrap: 22,
                    colorFill: "#0f172a",
                    colorStroke: "#38bdf8",
                    colorText: "#f8fafc",
                },
            ],
        } );

        useAppStore.getState().recolorAllNodesRandomly();

        expect( useAppStore.getState().conditions[ 0 ] ).toMatchObject( {
            colorFill: DEFAULT_LABEL_FILL,
            colorStroke: DEFAULT_LABEL_STROKE,
            colorText: DEFAULT_LABEL_TEXT,
        } );
    } );

    it( "uses uniform settings when recoloring all nodes, actions, and conditions", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( {
            colorMode: "uniform",
            uniformColorKey: "blue",
            uniformTone: "light",
            uniformIncludesActions: true,
            uniformIncludesConditions: true,
            nodes: [
                {
                    id: 1,
                    displayId: "1",
                    title: "Start",
                    x: 0,
                    y: 0,
                    w: 120,
                    h: 80,
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                    parentId: null,
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 0,
                    y: 0,
                    verb: "clicks",
                    complement: "Submit",
                    title: 'clicks "Submit"',
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                },
            ],
            conditions: [
                {
                    id: 1,
                    originActionId: 1,
                    title: "is enabled",
                    x: 0,
                    y: 0,
                    wrap: 22,
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                },
            ],
        } );

        useAppStore.getState().recolorAllNodesRandomly();

        expect( useAppStore.getState().nodes[ 0 ] ).toMatchObject( {
            colorFill: "#dbeafe",
            colorStroke: "#2563eb",
            colorText: "#172554",
        } );
        expect( useAppStore.getState().actions[ 0 ] ).toMatchObject( {
            colorFill: "#eff6ff",
            colorStroke: "#3b82f6",
            colorText: "#172554",
        } );
        expect( useAppStore.getState().conditions[ 0 ] ).toMatchObject( {
            colorFill: "#f8fafc",
            colorStroke: "#60a5fa",
            colorText: "#172554",
        } );
    } );

    it( "keeps conditions normal when recoloring all with uniform condition coloring disabled", () => {
        resetStoreForColorModeTest();
        useAppStore.setState( {
            colorMode: "uniform",
            uniformColorKey: "blue",
            uniformTone: "light",
            uniformIncludesActions: false,
            uniformIncludesConditions: false,
            nodes: [
                {
                    id: 1,
                    displayId: "1",
                    title: "Start",
                    x: 0,
                    y: 0,
                    w: 120,
                    h: 80,
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                    parentId: null,
                },
            ],
            actions: [
                {
                    id: 1,
                    originNodeId: 1,
                    x: 0,
                    y: 0,
                    verb: "clicks",
                    complement: "Submit",
                    title: 'clicks "Submit"',
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                },
            ],
            conditions: [
                {
                    id: 1,
                    originActionId: 1,
                    title: "is enabled",
                    x: 0,
                    y: 0,
                    wrap: 22,
                    colorFill: "#ffffff",
                    colorStroke: "#999999",
                    colorText: "#111111",
                },
            ],
        } );

        useAppStore.getState().recolorAllNodesRandomly();

        expect( useAppStore.getState().nodes[ 0 ] ).toMatchObject( {
            colorFill: "#dbeafe",
            colorStroke: "#2563eb",
            colorText: "#172554",
        } );
        expect( useAppStore.getState().actions[ 0 ] ).toMatchObject( {
            colorFill: "#dbeafe",
            colorStroke: "#2563eb",
            colorText: "#172554",
        } );
        expect( useAppStore.getState().conditions[ 0 ] ).toMatchObject( {
            colorFill: DEFAULT_LABEL_FILL,
            colorStroke: DEFAULT_LABEL_STROKE,
            colorText: DEFAULT_LABEL_TEXT,
        } );
    } );
} );
