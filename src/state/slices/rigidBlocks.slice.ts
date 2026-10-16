// src/state/slices/rigidBlocks.slice.ts
// Provides validated creation, removal, availability, and notices for visual RigidBlocks.

import type { StateCreator } from "zustand";
import type { AppState, RigidBlockAvailability, RigidBlockOperationResult } from "../types";
import {
    expandRigidBlockSelection,
    memberKey,
    validateRigidBlockSelection,
} from "../../rigidBlocks/rigidBlockModel";

function selectionFromState( state: AppState ) {
    return {
        nodes: new Set( state.selection ),
        actions: new Set( state.selectionActions ),
        conditions: new Set( state.selectionConds ),
    };
}

function selectedMemberKeys( state: AppState ): Set<string> {
    return new Set( expandRigidBlockSelection( {
        nodes: state.nodes,
        actions: state.actions,
        conditions: state.conditions,
        edges: state.edges,
        selection: selectionFromState( state ),
    } ).members.map( memberKey ) );
}

export const rigidBlocksSlice: StateCreator<AppState, [], [], Pick<
    AppState,
    | "rigidBlockNotice"
    | "createRigidBlockFromSelection"
    | "destroyRigidBlocksFromSelection"
    | "removeRigidBlockFromSelection"
    | "getRigidBlockAvailability"
    | "setRigidBlockNotice"
    | "dismissRigidBlockNotice"
>> = ( set, get ) => {
    const setNotice = ( notice: AppState[ "rigidBlockNotice" ] ) => set( { rigidBlockNotice: notice } );

    const getValidation = () => {
        const state = get();
        return validateRigidBlockSelection( {
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
            edges: state.edges,
            selection: selectionFromState( state ),
            existingBlocks: state.rigidBlocks,
        } );
    };

    const getBlocksForSelection = () => {
        const keys = selectedMemberKeys( get() );
        return get().rigidBlocks.filter( block => block.members.some( member => keys.has( memberKey( member ) ) ) );
    };

    return {
        rigidBlockNotice: null,

        setRigidBlockNotice: setNotice,
        dismissRigidBlockNotice: () => setNotice( null ),

        getRigidBlockAvailability: (): RigidBlockAvailability => {
            const validation = getValidation();
            const existingBlock = getBlocksForSelection()[ 0 ];
            return {
                canCreate: validation.ok,
                canRemove: existingBlock != null,
                createReason: validation.ok ? undefined : validation.error.message,
                createReasonCode: validation.ok ? undefined : validation.error.code,
                rigidBlockId: existingBlock?.id,
            };
        },

        createRigidBlockFromSelection: (): RigidBlockOperationResult => {
            const state = get();
            const validation = validateRigidBlockSelection( {
                nodes: state.nodes,
                actions: state.actions,
                conditions: state.conditions,
                edges: state.edges,
                selection: selectionFromState( state ),
                existingBlocks: state.rigidBlocks,
            } );
            if ( !validation.ok ) {
                setNotice( {
                    kind: "error",
                    code: validation.error.code,
                    message: validation.error.message,
                } );
                return validation;
            }

            const block = { id: state.nextRigidBlockId, members: validation.members };
            state.captureDelta( [ "rigidBlocks" ], () => {
                set( {
                    rigidBlocks: [ ...get().rigidBlocks, block ],
                    nextRigidBlockId: block.id + 1,
                    rigidBlockNotice: {
                        kind: "success",
                        message: "Rigid block created.",
                    },
                } );
            } );
            return { ok: true, block };
        },

        destroyRigidBlocksFromSelection: () => {
            const blocks = getBlocksForSelection();
            if ( blocks.length === 0 ) {
                setNotice( {
                    kind: "error",
                    code: "empty-selection",
                    message: "The selection does not contain a rigid block.",
                } );
                return false;
            }
            get().captureDelta( [ "rigidBlocks" ], () => {
                set( {
                    rigidBlocks: get().rigidBlocks.filter( candidate => !blocks.some( block => block.id === candidate.id ) ),
                    rigidBlockNotice: {
                        kind: "success",
                        message: `${blocks.length} rigid block${blocks.length === 1 ? "" : "s"} destroyed.`,
                    },
                } );
            } );
            return true;
        },

        removeRigidBlockFromSelection: () => get().destroyRigidBlocksFromSelection?.() ?? false,
    };
};
