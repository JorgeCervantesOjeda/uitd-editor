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

    // === Construir conjunto de movibles de manera “efectiva” ===
    // NODOS: sólo los devueltos por getSimulationSelectedNodes (raíces seleccionadas + su clausura)
    const simNodes = get().getSimulationSelectedNodes?.() ?? new Set<number>();
    // PARTÍCULAS: acciones/condiciones seleccionadas tal cual
    const selActs = get().selectionActions ?? new Set<number>();
    const selConds = get().selectionConds ?? new Set<number>();

    const movable = new Set<string>();
    for ( const id of simNodes ) movable.add( NK( id ) );
    for ( const id of selActs ) movable.add( AK( id ) );
    for ( const id of selConds ) movable.add( CK( id ) );

    // Si NO hay nada que mover → no corremos simulación
    if ( movable.size === 0 ) {
        // retorna un stopper inofensivo
        return () => { };
    }

    const sim = buildSimulatorFromStore( get(), physics, movable );

    if ( fastForward > 0 ) sim.run( Math.min( fastForward, iterations ) );

    // snapshot BEFORE (para diff luego)
    const beforeNodes = get().nodes.map( n => ( { ...n } ) );
    const beforeActions = get().actions.map( a => ( { ...a } ) );
    const beforeConditions = get().conditions.map( c => ( { ...c } ) );

    let step = fastForward;
    let raf = 0;

    const frame = () => {
        const toDo = Math.min( stepsPerFrame, Math.max( 0, iterations - step ) );
        if ( toDo > 0 ) {
            sim.run( toDo );
            step += toDo;
            applyPositionsToStore( sim.getPositions(), useAppStore.setState, get, movable );
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
