// src/io/serialization.ts
import type { AppState } from "../state/types";
import type { NodeBox, ActionLabel, ConditionLabel, Edge, RigidBlock } from "../model/types";
import type { ColorModeSettings } from "../colors/colorMode";

export type ProjectData = {
    version: 2;
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    rigidBlocks: RigidBlock[];
    nextRigidBlockId?: number;
    fragmentTitles?: Record<string, string>;
    panzoom?: { x: number; y: number; zoom: number };
    viewBox?: { w: number; h: number };
} & ColorModeSettings;

export function makeProjectSnapshot( s: AppState ): ProjectData {
    return {
        version: 2,
        nodes: s.nodes,
        actions: s.actions,
        conditions: s.conditions,
        edges: s.edges,
        rigidBlocks: s.rigidBlocks,
        nextRigidBlockId: s.nextRigidBlockId,
        fragmentTitles: s.fragmentTitles,
        panzoom: s.panzoom,
        viewBox: s.viewBox,
        colorMode: s.colorMode,
        uniformColorKey: s.uniformColorKey,
        uniformTone: s.uniformTone,
        uniformIncludesActions: s.uniformIncludesActions,
        uniformIncludesConditions: s.uniformIncludesConditions,
    };
}

export function computeNextCounters( data: ProjectData ) {
    const maxNode = Math.max( 0, ...data.nodes.map( n => n.id ) );
    const maxCond = Math.max( 0, ...data.conditions.map( c => c.id ) );
    const maxAction = Math.max( 0, ...data.actions.map( a => a.id ) );
    const maxEdge = Math.max( 0, ...data.edges.map( e => e.id ) );
    const maxRigidBlock = Math.max( 0, ...data.rigidBlocks.map( block => block.id ) );
    return {
        nextId: Math.max( maxNode, maxCond ) + 1,
        nextActionId: maxAction + 1,
        nextEdgeId: maxEdge + 1,
        nextRigidBlockId: maxRigidBlock + 1,
    };
}

function isRecord( v: unknown ): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

export function migrateProjectData( raw: unknown ): ProjectData {
    if ( !isRecord( raw ) || ( raw.version !== 1 && raw.version !== 2 ) ) throw new Error( "Invalid project file (version)." );
    if ( raw.version === 1 ) {
        console.info( "[serialization] Migrating project without RigidBlock metadata.", {
            cause: "The project uses version 1, before visual RigidBlocks were persisted.",
            fallback: "Adding rigidBlocks as an empty list and nextRigidBlockId as 1.",
            impact: "The diagram content is preserved, but no rigid grouping can be restored from version 1 data.",
        } );
        return { ...raw, version: 2, rigidBlocks: [], nextRigidBlockId: 1 } as unknown as ProjectData;
    }
    if ( !Array.isArray( raw.rigidBlocks ) ) {
        console.info( "[serialization] Project omitted RigidBlock metadata.", {
            cause: "The version 2 payload lacks the rigidBlocks array.",
            fallback: "Using an empty rigid block list.",
            impact: "The diagram loads without rigid grouping metadata.",
        } );
        return { ...raw, rigidBlocks: [], nextRigidBlockId: 1 } as unknown as ProjectData;
    }
    return raw as ProjectData;
}

/** Valida forma mínima y migra versiones compatibles. */
export function validateProjectData( raw: unknown ): ProjectData {
    const migrated = migrateProjectData( raw );
    if ( !Array.isArray( migrated.nodes ) || !Array.isArray( migrated.actions ) || !Array.isArray( migrated.conditions ) || !Array.isArray( migrated.edges ) ) {
        throw new Error( "Invalid project file (arrays)." );
    }
    return migrated;
}
