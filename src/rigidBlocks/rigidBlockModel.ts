// src/rigidBlocks/rigidBlockModel.ts
// Normalizes, validates, and measures persistent visual RigidBlock metadata.

import { buildFragmentGroups } from "../fragments/fragmentModel";
import {
    getActionSizeCached,
    getConditionSizeCached,
    getNodeSizeCached,
} from "../layout/measurement";
import type {
    ActionLabel,
    ConditionLabel,
    Edge,
    NodeBox,
    RigidBlock,
    RigidBlockMember,
} from "../model/types";

export const RIGID_BLOCK_PADDING = 4;

export type RigidBlockSelection = {
    nodes: Set<number>;
    actions: Set<number>;
    conditions: Set<number>;
};

export type RigidBlockBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    physicalArea: number;
    center: { x: number; y: number };
};

export type RigidBlockValidationErrorCode =
    | "empty-selection"
    | "multiple-fragments"
    | "member-overlap"
    | "missing-member"
    | "invalid-geometry";

export type RigidBlockValidationError = {
    code: RigidBlockValidationErrorCode;
    message: string;
    members?: RigidBlockMember[];
};

export type RigidBlockValidationResult =
    | { ok: true; members: RigidBlockMember[]; fragmentId: string }
    | { ok: false; error: RigidBlockValidationError };

type DiagramInput = {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges?: Edge[];
};

type ExpandInput = DiagramInput & { selection: RigidBlockSelection };

export type RigidBlockReconciliationResult = {
    rigidBlocks: RigidBlock[];
    removedBlockIds: number[];
};

export function memberKey( member: RigidBlockMember ): string {
    return `${member.kind}:${member.id}`;
}

function compareMembers( left: RigidBlockMember, right: RigidBlockMember ): number {
    const kindOrder = { node: 0, action: 1, condition: 2 } as const;
    return kindOrder[ left.kind ] - kindOrder[ right.kind ] || left.id - right.id;
}

function buildDescendantMap( nodes: NodeBox[] ): Map<number, number[]> {
    const children = new Map<number, number[]>();
    for ( const node of nodes ) {
        if ( node.parentId == null ) continue;
        const siblings = children.get( node.parentId ) ?? [];
        siblings.push( node.id );
        children.set( node.parentId, siblings );
    }
    return children;
}

function addNodeAndDescendants(
    nodeId: number,
    children: Map<number, number[]>,
    nodeIds: Set<number>
): void {
    if ( nodeIds.has( nodeId ) ) return;
    nodeIds.add( nodeId );
    for ( const childId of children.get( nodeId ) ?? [] ) {
        addNodeAndDescendants( childId, children, nodeIds );
    }
}

export function expandRigidBlockSelection( input: ExpandInput ): {
    nodes: Set<number>;
    actions: Set<number>;
    conditions: Set<number>;
    members: RigidBlockMember[];
} {
    const nodeIds = new Set<number>();
    const children = buildDescendantMap( input.nodes );
    for ( const nodeId of input.selection.nodes ) {
        addNodeAndDescendants( nodeId, children, nodeIds );
    }

    const members: RigidBlockMember[] = [
        ...Array.from( nodeIds, id => ( { kind: "node", id } as const ) ),
        ...Array.from( input.selection.actions, id => ( { kind: "action", id } as const ) ),
        ...Array.from( input.selection.conditions, id => ( { kind: "condition", id } as const ) ),
    ];
    const uniqueMembers = Array.from(
        new Map( members.map( member => [ memberKey( member ), member ] ) ).values()
    ).sort( compareMembers );

    return {
        nodes: nodeIds,
        actions: new Set( input.selection.actions ),
        conditions: new Set( input.selection.conditions ),
        members: uniqueMembers,
    };
}

function hasMember( input: DiagramInput, member: RigidBlockMember ): boolean {
    if ( member.kind === "node" ) return input.nodes.some( node => node.id === member.id );
    if ( member.kind === "action" ) return input.actions.some( action => action.id === member.id );
    return input.conditions.some( condition => condition.id === member.id );
}

function buildFragmentIdByMember( input: DiagramInput ): Map<string, string> {
    const result = new Map<string, string>();
    for ( const group of buildFragmentGroups( { ...input, edges: input.edges ?? [] } ) ) {
        for ( const id of group.nodeIds ) result.set( `node:${id}`, group.id );
        for ( const id of group.actionIds ) result.set( `action:${id}`, group.id );
        for ( const id of group.conditionIds ) result.set( `condition:${id}`, group.id );
    }
    return result;
}

export function validateRigidBlockSelection( input: ExpandInput & {
    existingBlocks: RigidBlock[];
} ): RigidBlockValidationResult {
    const expanded = expandRigidBlockSelection( input );
    if ( expanded.members.length === 0 ) {
        return { ok: false, error: { code: "empty-selection", message: "Select at least one canvas element." } };
    }

    const missingMembers = expanded.members.filter( member => !hasMember( input, member ) );
    if ( missingMembers.length > 0 ) {
        return {
            ok: false,
            error: {
                code: "missing-member",
                message: "The selection contains a canvas element that no longer exists.",
                members: missingMembers,
            },
        };
    }

    const existingMemberKeys = new Set(
        input.existingBlocks.flatMap( block => block.members.map( memberKey ) )
    );
    const overlappingMembers = expanded.members.filter( member => existingMemberKeys.has( memberKey( member ) ) );
    if ( overlappingMembers.length > 0 ) {
        return {
            ok: false,
            error: {
                code: "member-overlap",
                message: "One or more selected elements already belong to a rigid block.",
                members: overlappingMembers,
            },
        };
    }

    const fragmentIdByMember = buildFragmentIdByMember( input );
    const fragmentIds = new Set( expanded.members.map( member => fragmentIdByMember.get( memberKey( member ) ) ) );
    if ( fragmentIds.has( undefined ) || fragmentIds.size !== 1 ) {
        return {
            ok: false,
            error: {
                code: "multiple-fragments",
                message: "A rigid block can contain elements from only one fragment.",
            },
        };
    }

    return { ok: true, members: expanded.members, fragmentId: Array.from( fragmentIds )[ 0 ]! };
}

/** Removes persisted blocks whose membership is no longer valid or is duplicated. */
export function reconcileRigidBlocks(
    input: DiagramInput & { rigidBlocks: RigidBlock[] }
): RigidBlockReconciliationResult {
    const fragmentIdByMember = buildFragmentIdByMember( input );
    const claimedMembers = new Set<string>();
    const rigidBlocks: RigidBlock[] = [];
    const removedBlockIds: number[] = [];

    for ( const block of input.rigidBlocks ) {
        const memberKeys = block.members.map( memberKey );
        const fragmentIds = new Set( memberKeys.map( key => fragmentIdByMember.get( key ) ) );
        const valid = block.members.length > 0
            && new Set( memberKeys ).size === memberKeys.length
            && block.members.every( member => hasMember( input, member ) )
            && fragmentIds.size === 1
            && !fragmentIds.has( undefined )
            && memberKeys.every( key => !claimedMembers.has( key ) );

        if ( !valid ) {
            removedBlockIds.push( block.id );
            continue;
        }

        for ( const key of memberKeys ) claimedMembers.add( key );
        rigidBlocks.push( block );
    }

    return { rigidBlocks, removedBlockIds };
}

type BoundsInput = Omit<DiagramInput, "edges"> & { members: RigidBlockMember[] };

function getMemberGeometry( input: DiagramInput, member: RigidBlockMember ): { x: number; y: number; w: number; h: number } | null {
    if ( member.kind === "node" ) {
        const node = input.nodes.find( candidate => candidate.id === member.id );
        if ( !node ) return null;
        const size = getNodeSizeCached( node );
        return { x: node.x, y: node.y, w: size.w, h: size.h };
    }
    if ( member.kind === "action" ) {
        const action = input.actions.find( candidate => candidate.id === member.id );
        if ( !action ) return null;
        const size = getActionSizeCached( action );
        return { x: action.x, y: action.y, w: size.w, h: size.h };
    }
    const condition = input.conditions.find( candidate => candidate.id === member.id );
    if ( !condition ) return null;
    const size = getConditionSizeCached( condition );
    return { x: condition.x, y: condition.y, w: size.w, h: size.h };
}

export function buildRigidBlockBounds( input: BoundsInput ): RigidBlockBounds | null {
    const geometries = input.members
        .map( member => getMemberGeometry( input, member ) )
        .filter( ( geometry ): geometry is NonNullable<typeof geometry> => geometry !== null );
    if ( geometries.length !== input.members.length || geometries.length === 0 ) return null;

    const left = Math.min( ...geometries.map( geometry => geometry.x - geometry.w / 2 ) ) - RIGID_BLOCK_PADDING;
    const right = Math.max( ...geometries.map( geometry => geometry.x + geometry.w / 2 ) ) + RIGID_BLOCK_PADDING;
    const top = Math.min( ...geometries.map( geometry => geometry.y - geometry.h / 2 ) ) - RIGID_BLOCK_PADDING;
    const bottom = Math.max( ...geometries.map( geometry => geometry.y + geometry.h / 2 ) ) + RIGID_BLOCK_PADDING;
    const physicalArea = geometries.reduce( ( total, geometry ) => total + geometry.w * geometry.h, 0 );
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        physicalArea,
        center: { x: ( left + right ) / 2, y: ( top + bottom ) / 2 },
    };
}
