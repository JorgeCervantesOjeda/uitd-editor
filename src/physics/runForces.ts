// src/physics/runForces.ts
import { useAppStore } from "../state/store";
import { buildSimulatorFromStore, applyPositionsToStore } from "./adapter";
import type { SimulatorOptions } from "./adapter";

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

    // Construye el set de movibles (nodos/acciones/condiciones seleccionados).
    // Si está vacío, la simulación corre para todo (como antes).
    const s = get();
    const movable = new Set<string>();
    s.selection?.forEach( ( id: number ) => movable.add( NK( id ) ) );
    s.selectionActions?.forEach( ( id: number ) => movable.add( AK( id ) ) );
    s.selectionConds?.forEach( ( id: number ) => movable.add( CK( id ) ) );
    const onlyIds = movable.size ? movable : undefined;

    // Todos contribuyen fuerzas y resortes; sólo movable se integra
    const sim = buildSimulatorFromStore( get(), physics, onlyIds );

    if ( fastForward > 0 ) sim.run( Math.min( fastForward, iterations ) );

    let step = fastForward;
    let raf = 0;

    const frame = () => {
        const toDo = Math.min( stepsPerFrame, Math.max( 0, iterations - step ) );
        if ( toDo > 0 ) {
            sim.run( toDo );
            step += toDo;
            // Escribimos posiciones sólo de ids movibles (doble cerrojo)
            applyPositionsToStore( sim.getPositions(), useAppStore.setState, get, onlyIds );
        }
        if ( step < iterations ) raf = requestAnimationFrame( frame );
        else cancelAnimationFrame( raf );
    };

    raf = requestAnimationFrame( frame );
    return () => cancelAnimationFrame( raf );
}
