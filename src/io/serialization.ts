// src/io/serialization.ts
import type { AppState } from "../state/store";
import type { NodeBox, ActionLabel, ConditionLabel, Edge } from "../model/types";

export type ProjectData = {
    version: 1;
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    panzoom?: { x: number; y: number; zoom: number };
    viewBox?: { w: number; h: number };
};

export function makeProjectSnapshot( s: AppState ): ProjectData {
    return {
        version: 1,
        nodes: s.nodes,
        actions: s.actions,
        conditions: s.conditions,
        edges: s.edges,
        panzoom: s.panzoom,
        viewBox: s.viewBox,
    };
}

export function computeNextCounters( data: ProjectData ) {
    const maxNode = Math.max( 0, ...data.nodes.map( n => n.id ) );
    const maxCond = Math.max( 0, ...data.conditions.map( c => c.id ) );
    const maxAction = Math.max( 0, ...data.actions.map( a => a.id ) );
    const maxEdge = Math.max( 0, ...data.edges.map( e => e.id ) );
    return {
        nextId: Math.max( maxNode, maxCond ) + 1,
        nextActionId: maxAction + 1,
        nextEdgeId: maxEdge + 1,
    };
}

/** Valida forma mínima y lanza si está mal. */
export function validateProjectData( raw: any ): ProjectData {
    if ( !raw || raw.version !== 1 ) throw new Error( "Invalid project file (version)." );
    if ( !Array.isArray( raw.nodes ) || !Array.isArray( raw.actions ) || !Array.isArray( raw.conditions ) || !Array.isArray( raw.edges ) ) {
        throw new Error( "Invalid project file (arrays)." );
    }
    return raw as ProjectData;
}
