// src/import/uitdl/build.test.ts
// Verifies UITDL import graph construction from parsed UITDL fragments.

import { describe, expect, it } from "vitest";
import { parseUITDL } from "./parser";
import { buildProjectFromAST } from "./build";
import type { AppState } from "../../state/types";

const baseState = {
    panzoom: { x: 0, y: 0, zoom: 1 },
    viewBox: { w: 1000, h: 800 },
} as AppState;

describe( "buildProjectFromAST", () => {
    it( "does not duplicate declared actions already represented by transitions", () => {
        const ast = parseUITDL( `
            UITD "Import duplicate action test" {
                UI 1 "Canvas" actions {
                    clicks "Open";
                    clicks "Pan";
                    clicks "Loose";
                }

                UI 2 "Editor" actions {
                    clicks "Close";
                }

                FRAGMENT "Main navigation" {
                    DRAW { 1, 2 };
                    TRANSITION from 1 to 2 if user clicks "Open";
                }

                FRAGMENT "Canvas same-state interactions" {
                    DRAW { 1 };
                    TRANSITION from 1 to 1 if user clicks "Pan";
                }
            }
        ` );

        const project = buildProjectFromAST( ast, baseState );

        const actionsByComplement = new Map(
            project.actions.map( action => [ action.complement, action ] )
        );
        const openActions = project.actions.filter( action => action.complement === "Open" );
        const panActions = project.actions.filter( action => action.complement === "Pan" );
        const looseAction = actionsByComplement.get( "Loose" );

        expect( openActions ).toHaveLength( 1 );
        expect( panActions ).toHaveLength( 1 );
        expect( looseAction ).toBeDefined();

        const looseOutgoing = project.edges.filter(
            edge => edge.from.kind === "action" && edge.from.id === looseAction?.id
        );
        expect( looseOutgoing ).toHaveLength( 0 );
    } );

    it( "advances the shared node and condition counter beyond imported condition IDs", () => {
        const ast = parseUITDL( `
            UITD "Condition counter" {
                UI 1 "Start" actions { clicks "Continue"; }
                UI 2 "End" actions {}
                FRAGMENT "Conditional paths" {
                    DRAW { 1, 2 };
                    TRANSITION from 1 to 2 if user clicks "Continue" AND "condition one";
                    TRANSITION from 1 to 2 if user clicks "Continue" AND "condition two";
                    TRANSITION from 1 to 2 if user clicks "Continue" AND "condition three";
                    TRANSITION from 1 to 2 if user clicks "Continue" AND "condition four";
                }
            }
        ` );

        const project = buildProjectFromAST( ast, baseState );
        const maxImportedNodeOrConditionId = Math.max(
            ...project.nodes.map( node => node.id ),
            ...project.conditions.map( condition => condition.id )
        );

        expect( project.conditions ).toHaveLength( 4 );
        expect( project.nextId ).toBe( maxImportedNodeOrConditionId + 1 );
    } );
} );
