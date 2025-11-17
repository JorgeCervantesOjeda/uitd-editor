import { useAppStore } from "../state/store";
import { buildSimulatorFromStore, applyPositionsToStore } from "./adapter";
import type { SimulatorOptions } from "./adapter";
import { buildPatches, type Delta } from "../state/slices/history.slice";

type RunOptions = {
    iterations: number;
    stepsPerFrame?: number;
    fastForward?: number;
    physics?: SimulatorOptions;
};

const NK = ( id: number ) => `N.${id}`;
const AK = ( id: number ) => `A.${id}`;
const CK = ( id: number ) => `C.${id}`;

export function startForcesRun( opts: RunOptions ) {
    const { iterations, stepsPerFrame = 10, fastForward = 0, physics } = opts;

    const get = useAppStore.getState;

    const s0 = get();
    const movable = new Set<string>();
    s0.selection?.forEach( ( id: number ) => movable.add( NK( id ) ) );
    s0.selectionActions?.forEach( ( id: number ) => movable.add( AK( id ) ) );
    s0.selectionConds?.forEach( ( id: number ) => movable.add( CK( id ) ) );
    const onlyIds = movable.size ? movable : undefined;

    const sim = buildSimulatorFromStore( get(), physics, onlyIds );

    if ( fastForward > 0 ) sim.run( Math.min( fastForward, iterations ) );

    // snapshot BEFORE (para diff luego)
    const beforeNodes = get().nodes.map( ( n ) => ( { ...n } ) );
    const beforeActions = get().actions.map( ( a ) => ( { ...a } ) );
    const beforeConditions = get().conditions.map( ( c ) => ( { ...c } ) );

    let step = fastForward;
    let raf = 0;

    const frame = () => {
        const toDo = Math.min( stepsPerFrame, Math.max( 0, iterations - step ) );
        if ( toDo > 0 ) {
            sim.run( toDo );
            step += toDo;
            applyPositionsToStore( sim.getPositions(), useAppStore.setState, get, onlyIds );
        }
        if ( step < iterations ) {
            raf = requestAnimationFrame( frame );
        } else {
            cancelAnimationFrame( raf );

            // snapshot AFTER
            const afterNodes = get().nodes;
            const afterActions = get().actions;
            const afterConditions = get().conditions;

            const nodePatches = buildPatches( beforeNodes, afterNodes );
            const actionPatches = buildPatches( beforeActions, afterActions );
            const condPatches = buildPatches( beforeConditions, afterConditions );

            const delta: Delta = {};
            if ( nodePatches.length ) delta.nodes = nodePatches;
            if ( actionPatches.length ) delta.actions = actionPatches;
            if ( condPatches.length ) delta.conditions = condPatches;

            if (
                ( delta.nodes && delta.nodes.length ) ||
                ( delta.actions && delta.actions.length ) ||
                ( delta.conditions && delta.conditions.length )
            ) {
                useAppStore.getState().pushDelta( delta );
            }
        }
    };

    raf = requestAnimationFrame( frame );
    return () => cancelAnimationFrame( raf );
}
