import { useAppStore } from "../state/store";
import { buildSimulatorFromStore, applyPositionsToStore } from "./adapter";
import type { SimulatorOptions } from "./adapter";
import { buildPatches, type Delta } from "../state/slices/history.slice";

export type ForcesRunFinishReason = "converged" | "cancelled" | "max_iterations" | "stalled";

export type ForcesRunProgress = {
    iterations: number;
    totalIterations: number | null;
    maxDisp: number;
    convergenceThreshold: number;
    stableFrames: number;
    stableFramesRequired: number;
    stopWhenConverged: boolean;
};

type RunOptions = {
    iterations: number;
    stepsPerFrame?: number;
    fastForward?: number;
    physics?: SimulatorOptions;
    stopWhenConverged?: boolean;
    convergenceThreshold?: number;
    stableFramesRequired?: number;
    stopWhenStalled?: boolean;
    stallFramesRequired?: number;
    stallImprovementThreshold?: number;
    onProgress?: ( status: ForcesRunProgress ) => void;
    onFinish?: ( reason: ForcesRunFinishReason ) => void;
};

const NK = ( id: number ) => `N.${id}`;
const AK = ( id: number ) => `A.${id}`;
const CK = ( id: number ) => `C.${id}`;

export function startForcesRun( opts: RunOptions ) {
    const {
        iterations,
        stepsPerFrame = 10,
        fastForward = 0,
        physics,
        stopWhenConverged = false,
        convergenceThreshold = 1,
        stableFramesRequired = 12,
        stopWhenStalled = false,
        stallFramesRequired = 120,
        stallImprovementThreshold = 0.5,
        onProgress,
        onFinish,
    } = opts;
    const get = useAppStore.getState;
    const totalIterations =
        Number.isFinite( iterations )
            ? Math.max( 0, Math.floor( iterations ) )
            : Number.POSITIVE_INFINITY;
    const ff = Math.max( 0, Math.floor( fastForward ) );
    const hasIterationLimit = Number.isFinite( totalIterations );

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

    // snapshot BEFORE (para diff luego)
    const beforeNodes = get().nodes.map( n => ( { ...n } ) );
    const beforeActions = get().actions.map( a => ( { ...a } ) );
    const beforeConditions = get().conditions.map( c => ( { ...c } ) );

    let step = 0;
    let stableFrames = 0;
    let stalledFrames = 0;
    let bestMaxDisp = Number.POSITIVE_INFINITY;
    let raf = 0;
    let finished = false;

    const emitProgress = ( maxDisp: number ) => {
        onProgress?.( {
            iterations: step,
            totalIterations: hasIterationLimit ? totalIterations : null,
            maxDisp,
            convergenceThreshold,
            stableFrames,
            stableFramesRequired,
            stopWhenConverged,
        } );
    };

    const finalizeHistoryDelta = () => {
        if ( finished ) return;
        finished = true;

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
    };

    const finalize = ( reason: ForcesRunFinishReason ) => {
        if ( finished ) return;
        cancelAnimationFrame( raf );
        finalizeHistoryDelta();
        onFinish?.( reason );
    };

    const runBatch = ( count: number ) => {
        if ( count <= 0 ) return false;
        const stats = sim.run( count );
        step += count;
        applyPositionsToStore( sim.getPositions(), useAppStore.setState, get, movable );
        stableFrames = stats.maxDisp <= convergenceThreshold ? stableFrames + 1 : 0;

        const improved = bestMaxDisp - stats.maxDisp >= stallImprovementThreshold;
        if ( improved ) {
            bestMaxDisp = stats.maxDisp;
            stalledFrames = 0;
        } else {
            if ( stats.maxDisp < bestMaxDisp ) bestMaxDisp = stats.maxDisp;
            stalledFrames += 1;
        }

        emitProgress( stats.maxDisp );

        if ( stopWhenConverged && stableFrames >= stableFramesRequired ) {
            finalize( "converged" );
            return true;
        }
        if ( stopWhenStalled && stalledFrames >= stallFramesRequired ) {
            finalize( "stalled" );
            return true;
        }
        return false;
    };

    const initialFastForward = hasIterationLimit ? Math.min( ff, totalIterations ) : ff;
    if ( runBatch( initialFastForward ) ) return () => { };

    const frame = () => {
        if ( finished ) return;

        const remaining = hasIterationLimit ? Math.max( 0, totalIterations - step ) : stepsPerFrame;
        const toDo = hasIterationLimit ? Math.min( stepsPerFrame, remaining ) : stepsPerFrame;

        if ( runBatch( toDo ) ) {
            return;
        }

        if ( hasIterationLimit && step >= totalIterations ) {
            finalize( "max_iterations" );
            return;
        }

        raf = requestAnimationFrame( frame );
    };

    raf = requestAnimationFrame( frame );
    return () => {
        finalize( "cancelled" );
    };
}
