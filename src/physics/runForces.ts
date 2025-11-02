// src/physics/runForces.ts
import { useAppStore } from "../state/store";
import { buildSimulatorFromStore, applyPositionsToStore } from "./adapter";
import type { SimulatorOptions } from "./adapter";

type RunOptions = {
    iterations: number;
    stepsPerFrame?: number;
    fastForward?: number;
    physics?: SimulatorOptions;   // ⬅️ nuevo: opciones físicas
};

export function startForcesRun( opts: RunOptions ) {
    const { iterations, stepsPerFrame = 10, fastForward = 0, physics } = opts;

    const get = useAppStore.getState;

    const sim = buildSimulatorFromStore( get(), physics );

    if ( fastForward > 0 ) sim.run( Math.min( fastForward, iterations ) );

    let step = fastForward;
    let raf = 0;

    const frame = () => {
        const toDo = Math.min( stepsPerFrame, Math.max( 0, iterations - step ) );
        if ( toDo > 0 ) {
            sim.run( toDo );
            step += toDo;
            applyPositionsToStore( sim.getPositions(), useAppStore.setState, get );
        }
        if ( step < iterations ) raf = requestAnimationFrame( frame );
        else cancelAnimationFrame( raf );
    };

    raf = requestAnimationFrame( frame );
    return () => cancelAnimationFrame( raf );
}
