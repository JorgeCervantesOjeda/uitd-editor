// src/state/slices/fragments.slice.ts
// Provides canvas-level operations that act on whole fragment groups.

import type { StateCreator } from "zustand";
import type { AppState, ActionLabel, ConditionLabel, NodeBox } from "../types";
import { buildFragmentBounds, type FragmentBounds } from "../../fragments/fragmentBounds";
import { compactFragmentBoundsToGrid } from "../../fragments/compactFragmentGrid";

type DeltaPoint = {
    dx: number;
    dy: number;
};

export type FragmentsSlice = {
    compactFragmentsToGrid: () => void;
};

function buildFragmentDeltaMaps(
    fragments: FragmentBounds[],
    placements: { id: string; x: number; y: number }[]
): {
    nodeDeltas: Map<number, DeltaPoint>;
    actionDeltas: Map<number, DeltaPoint>;
    conditionDeltas: Map<number, DeltaPoint>;
} {
    const placementById = new Map( placements.map( placement => [ placement.id, placement ] ) );
    const nodeDeltas = new Map<number, DeltaPoint>();
    const actionDeltas = new Map<number, DeltaPoint>();
    const conditionDeltas = new Map<number, DeltaPoint>();

    for ( const fragment of fragments ) {
        const placement = placementById.get( fragment.id );
        if ( !placement ) continue;

        const delta = {
            dx: placement.x - fragment.x,
            dy: placement.y - fragment.y,
        };
        if ( Math.abs( delta.dx ) < 0.001 && Math.abs( delta.dy ) < 0.001 ) continue;

        for ( const nodeId of fragment.nodeIds ) nodeDeltas.set( nodeId, delta );
        for ( const actionId of fragment.actionIds ) actionDeltas.set( actionId, delta );
        for ( const conditionId of fragment.conditionIds ) conditionDeltas.set( conditionId, delta );
    }

    return { nodeDeltas, actionDeltas, conditionDeltas };
}

function moveNodes( nodes: NodeBox[], deltas: Map<number, DeltaPoint> ): NodeBox[] {
    if ( deltas.size === 0 ) return nodes;
    return nodes.map( node => {
        const delta = deltas.get( node.id );
        return delta ? { ...node, x: node.x + delta.dx, y: node.y + delta.dy } : node;
    } );
}

function moveActions( actions: ActionLabel[], deltas: Map<number, DeltaPoint> ): ActionLabel[] {
    if ( deltas.size === 0 ) return actions;
    return actions.map( action => {
        const delta = deltas.get( action.id );
        return delta ? { ...action, x: action.x + delta.dx, y: action.y + delta.dy } : action;
    } );
}

function moveConditions( conditions: ConditionLabel[], deltas: Map<number, DeltaPoint> ): ConditionLabel[] {
    if ( deltas.size === 0 ) return conditions;
    return conditions.map( condition => {
        const delta = deltas.get( condition.id );
        return delta ? { ...condition, x: condition.x + delta.dx, y: condition.y + delta.dy } : condition;
    } );
}

function reportSkippedFragmentCompaction( cause: string ): void {
    console.info( "[Fragments] Skipped grid compaction.", {
        cause,
        fallback: "Keeping current fragment positions.",
        impact: "No diagram items were moved.",
    } );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fragmentsSlice: StateCreator<AppState, [], [], FragmentsSlice> = ( set, get, _api ) => ( {
    compactFragmentsToGrid: () => {
        const state = get();
        if ( state.isCanvasLockedByUITDLLiveSync ) {
            reportSkippedFragmentCompaction( "The canvas is locked by Live to canvas sync." );
            return;
        }

        const fragments = buildFragmentBounds( {
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
            edges: state.edges,
            fragmentTitles: state.fragmentTitles,
        } );

        if ( fragments.length < 2 ) {
            reportSkippedFragmentCompaction( "At least two fragments are required to build a grid." );
            return;
        }

        const placements = compactFragmentBoundsToGrid( fragments );
        const { nodeDeltas, actionDeltas, conditionDeltas } = buildFragmentDeltaMaps( fragments, placements );

        if ( nodeDeltas.size === 0 && actionDeltas.size === 0 && conditionDeltas.size === 0 ) {
            reportSkippedFragmentCompaction( "Fragments already match the computed grid positions." );
            return;
        }

        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            set( previous => ( {
                nodes: moveNodes( previous.nodes, nodeDeltas ),
                actions: moveActions( previous.actions, actionDeltas ),
                conditions: moveConditions( previous.conditions, conditionDeltas ),
            } ) );
        } );
    },
} );
