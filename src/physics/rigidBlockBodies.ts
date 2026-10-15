// src/physics/rigidBlockBodies.ts
// Converts persistent visual RigidBlocks into translated physics-body inputs.

import { buildFragmentGroups } from "../fragments/fragmentModel";
import { buildRigidBlockBounds, memberKey } from "../rigidBlocks/rigidBlockModel";
import type { AppState } from "../state/types";
import type { RigidBlockMember } from "../model/types";
import type { Vec2 } from "./force-simulator";

export type RigidBodyMemberInput = {
    id: string;
    offset: Vec2;
};

export type RigidBodyInput = {
    id: string;
    center: Vec2;
    width: number;
    height: number;
    area: number;
    members: RigidBodyMemberInput[];
};

export const rigidBodyKey = ( id: number ): string => `RB.${id}`;

const nodeKey = ( id: number ): string => `N.${id}`;
const actionKey = ( id: number ): string => `A.${id}`;
const conditionKey = ( id: number ): string => `C.${id}`;

function simulationKey( member: RigidBlockMember ): string {
    if ( member.kind === "node" ) return nodeKey( member.id );
    if ( member.kind === "action" ) return actionKey( member.id );
    return conditionKey( member.id );
}

function memberPosition( state: AppState, member: RigidBlockMember ): Vec2 | null {
    if ( member.kind === "node" ) {
        const node = state.nodes.find( candidate => candidate.id === member.id );
        return node ? { x: node.x, y: node.y } : null;
    }
    if ( member.kind === "action" ) {
        const action = state.actions.find( candidate => candidate.id === member.id );
        return action ? { x: action.x, y: action.y } : null;
    }
    const condition = state.conditions.find( candidate => candidate.id === member.id );
    return condition ? { x: condition.x, y: condition.y } : null;
}

function fragmentIdByMember( state: AppState ): Map<string, string> {
    const map = new Map<string, string>();
    for ( const group of buildFragmentGroups( state ) ) {
        for ( const id of group.nodeIds ) map.set( `node:${id}`, group.id );
        for ( const id of group.actionIds ) map.set( `action:${id}`, group.id );
        for ( const id of group.conditionIds ) map.set( `condition:${id}`, group.id );
    }
    return map;
}

export function buildRigidBodyInputs(
    state: Pick<AppState, "nodes" | "actions" | "conditions" | "edges" | "rigidBlocks">,
    includedIds?: Set<string>
): RigidBodyInput[] {
    const fragmentMap = fragmentIdByMember( state as AppState );
    const bodies: RigidBodyInput[] = [];

    for ( const block of state.rigidBlocks ) {
        const blockBounds = buildRigidBlockBounds( {
            members: block.members,
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
        } );
        const memberPositions = block.members.map( member => memberPosition( state as AppState, member ) );
        const fragmentIds = new Set( block.members.map( member => fragmentMap.get( memberKey( member ) ) ) );
        const canInclude = block.members.every( member => includedIds === undefined || includedIds.has( simulationKey( member ) ) );

        if ( !blockBounds || memberPositions.some( position => position === null ) || fragmentIds.size !== 1 || fragmentIds.has( undefined ) || !canInclude ) {
            console.warn( "[RigidBlockPhysics] Skipping invalid rigid block input.", {
                cause: !blockBounds || memberPositions.some( position => position === null )
                    ? "A block member has no resolvable canvas geometry."
                    : fragmentIds.size !== 1 || fragmentIds.has( undefined )
                        ? "A persisted block no longer resolves to one fragment."
                        : "The current independent simulation does not include every block member.",
                fallback: "The affected block is excluded from this simulation instance.",
                impact: "Other valid elements continue simulating without a stale cross-fragment body.",
                blockId: block.id,
            } );
            continue;
        }

        bodies.push( {
            id: rigidBodyKey( block.id ),
            center: blockBounds.center,
            width: blockBounds.width,
            height: blockBounds.height,
            area: blockBounds.width * blockBounds.height,
            members: block.members.map( ( member, index ) => ( {
                id: simulationKey( member ),
                offset: {
                    x: memberPositions[ index ]!.x - blockBounds.center.x,
                    y: memberPositions[ index ]!.y - blockBounds.center.y,
                },
            } ) ),
        } );
    }

    return bodies;
}
