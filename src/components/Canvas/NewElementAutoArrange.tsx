// src/components/Canvas/NewElementAutoArrange.tsx
// Coordinates automatic arrangement after an individual canvas element is created.

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import { newElementSelection } from "../../state/newElementSelection";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import { sanitizeSimParams, SIM_PARAMS_STORAGE_KEY } from "../../physics/simParamsStorage";
import { startForcesRun, type ForcesRunProgress } from "../../physics/runForces";
import { SimulationProgressDialog } from "./SimulationProgressDialog";

function loadArrangementSettings() {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_STORAGE_KEY );
        return raw ? sanitizeSimParams( JSON.parse( raw ), DEFAULT_SIM_PARAMS ) : DEFAULT_SIM_PARAMS;
    } catch ( cause ) {
        console.warn( "Could not load new-element arrangement settings.", {
            cause, fallback: "Use default settings", impact: "New elements use the default arrangement parameters",
        } );
        return DEFAULT_SIM_PARAMS;
    }
}

export function NewElementAutoArrange() {
    const target = useAppStore( s => s.autoArrangeQueue[ 0 ] );
    const [ progress, setProgress ] = useState<ForcesRunProgress | null>( null );
    const stopRef = useRef<() => void>( () => {} );

    useEffect( () => {
        if ( !target ) return;
        const state = useAppStore.getState();
        const items = target.kind === "node" ? state.nodes : target.kind === "action" ? state.actions : state.conditions;
        const finish = () => {
            setProgress( null );
            useAppStore.setState( s => ( { autoArrangeQueue: s.autoArrangeQueue.filter( item => item !== target ) } ) );
        };
        if ( !items.some( item => item.id === target.id ) || state.isCanvasLockedByUITDLLiveSync ) {
            finish();
            return;
        }

        useAppStore.setState( newElementSelection( target ) );
        const settings = loadArrangementSettings();
        setProgress( {
            iterations: 0, totalIterations: settings.iterations,
            maxDisp: Number.POSITIVE_INFINITY, convergenceThreshold: 1,
            stableFrames: 0, stableFramesRequired: 12, stopWhenConverged: true,
        } );
        let stopRun: ( () => void ) | null = null;
        let active = true;
        let frame = 0;
        // Two frames let the newly selected element and progress dialog paint before physics work.
        frame = requestAnimationFrame( () => {
            frame = requestAnimationFrame( () => {
                const current = useAppStore.getState();
                const currentItems = target.kind === "node" ? current.nodes : target.kind === "action" ? current.actions : current.conditions;
                if ( !currentItems.some( item => item.id === target.id ) || current.isCanvasLockedByUITDLLiveSync ) {
                    finish();
                    return;
                }
                useAppStore.setState( newElementSelection( target ) );
                stopRun = startForcesRun( {
                    iterations: settings.iterations,
                    stepsPerFrame: settings.stepsPerFrame,
                    fastForward: 0,
                    physics: settings,
                    stopWhenConverged: true,
                    stopWhenStalled: true,
                    onProgress: next => { if ( active ) setProgress( next ); },
                    onFinish: () => { if ( active ) finish(); },
                } );
            } );
        } );
        stopRef.current = () => {
            cancelAnimationFrame( frame );
            if ( stopRun ) stopRun();
            else finish();
        };
        return () => {
            active = false;
            cancelAnimationFrame( frame );
            stopRun?.();
        };
    }, [ target ] );

    return (
        <div onKeyDown={ event => event.stopPropagation() }>
            <SimulationProgressDialog open={ progress != null } progress={ progress } onStop={ () => stopRef.current() } />
        </div>
    );
}
