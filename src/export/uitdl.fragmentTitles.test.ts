import { describe, expect, it } from "vitest";
import { buildFragmentGroups } from "../fragments/fragmentModel";
import type { AppState } from "../state/types";
import { exportToUITDL } from "./uitdl";

describe( "exportToUITDL fragment titles", () => {
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
} );
