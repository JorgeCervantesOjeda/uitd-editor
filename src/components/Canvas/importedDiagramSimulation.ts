// src/components/Canvas/importedDiagramSimulation.ts
// Shares post-UITDL-import container layout, force simulation, progress, and viewport centering.

import { useEffect, useRef, useState } from "react";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../../layout/measurement";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import {
    startForcesRun,
    type ForcesRunFinishReason,
    type ForcesRunProgress,
} from "../../physics/runForces";
import { SIM_PARAMS_STORAGE_KEY, sanitizeSimParams } from "../../physics/simParamsStorage";
import { useAppStore } from "../../state/store";
import type { ActionLabel, ConditionLabel, NodeBox } from "../../state/types";

function loadSimulationParameters() {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_STORAGE_KEY );
        if ( !raw ) return DEFAULT_SIM_PARAMS;
        return sanitizeSimParams( JSON.parse( raw ) as unknown, DEFAULT_SIM_PARAMS );
    } catch ( error ) {
        console.warn( "Failed to load simulation parameters for imported UITDL.", {
            cause: error,
            fallback: "Use default simulation parameters.",
            impact: "The imported layout may differ from the saved simulation configuration.",
        } );
        return DEFAULT_SIM_PARAMS;
    }
}

export function relayoutImportedContainers() {
    const state = useAppStore.getState();
    const parentIds = new Set<number>();
    for ( const node of state.nodes ) {
        if ( node.parentId != null ) parentIds.add( node.parentId );
    }
    for ( const parentId of parentIds ) {
        state.relayoutContainer( parentId );
        state.relayoutAncestors( parentId );
    }
}

export function centerImportedDiagramInView() {
    const state = useAppStore.getState();
    const items: Array<{ x: number; y: number; w: number; h: number }> = [];

    for ( const node of state.nodes as NodeBox[] ) {
        const measurement = getNodeSizeCached( node );
        items.push( { x: node.x, y: node.y, w: measurement.w, h: measurement.h } );
    }
    for ( const action of state.actions as ActionLabel[] ) {
        const measurement = measureActionOval( action.title, action.wrap ?? 22 );
        items.push( { x: action.x, y: action.y, w: measurement.w, h: measurement.h } );
    }
    for ( const condition of state.conditions as ConditionLabel[] ) {
        const measurement = measureConditionOval( condition.title, condition.wrap ?? 22 );
        items.push( { x: condition.x, y: condition.y, w: measurement.w, h: measurement.h } );
    }

    if ( items.length === 0 ) {
        useAppStore.setState( current => ( {
            panzoom: { ...current.panzoom, x: 0, y: 0, zoom: 1 },
        } ) );
        return;
    }

    const minX = Math.min( ...items.map( item => item.x - item.w / 2 ) );
    const maxX = Math.max( ...items.map( item => item.x + item.w / 2 ) );
    const minY = Math.min( ...items.map( item => item.y - item.h / 2 ) );
    const maxY = Math.max( ...items.map( item => item.y + item.h / 2 ) );
    const contentWidth = maxX - minX || 1;
    const contentHeight = maxY - minY || 1;
    const viewWidth = state.viewBox.w || 800;
    const viewHeight = state.viewBox.h || 600;
    const zoom = Math.min( viewWidth / ( contentWidth + 80 ), viewHeight / ( contentHeight + 80 ) );
    const safeZoom = Number.isFinite( zoom ) && zoom > 0 ? zoom : 1;
    const centerX = ( minX + maxX ) / 2;
    const centerY = ( minY + maxY ) / 2;

    useAppStore.setState( current => ( {
        panzoom: {
            ...current.panzoom,
            x: viewWidth / 2 - safeZoom * centerX,
            y: viewHeight / 2 - safeZoom * centerY,
            zoom: safeZoom,
        },
    } ) );
}

export function useImportedDiagramSimulation() {
    const stopRef = useRef<( () => void ) | null>( null );
    const isMountedRef = useRef( true );
    const [ progress, setProgress ] = useState<ForcesRunProgress | null>( null );

    const stopSimulation = () => {
        if ( !stopRef.current ) return;
        const stop = stopRef.current;
        stopRef.current = null;
        stop();
    };

    const finishSimulation = ( reason: ForcesRunFinishReason ) => {
        stopRef.current = null;
        if ( isMountedRef.current ) setProgress( null );
        useAppStore.getState().clearSelection?.();
        centerImportedDiagramInView();
        if ( reason === "max_iterations" ) {
            window.alert( "La simulación se detuvo sin converger completamente." );
        }
        if ( reason === "stalled" ) {
            window.alert( "La simulación se detuvo por estancamiento." );
        }
    };

    const runSimulation = () => {
        const state = useAppStore.getState();
        const totalItems = state.nodes.length + state.actions.length + state.conditions.length;
        if ( totalItems === 0 ) {
            centerImportedDiagramInView();
            return;
        }

        const parameters = loadSimulationParameters();
        const convergenceThreshold = 20;
        const stableFramesRequired = 12;
        useAppStore.setState( {
            selection: new Set<number>( state.nodes.map( node => node.id ) ),
            selectionActions: new Set<number>( state.actions.map( action => action.id ) ),
            selectionConds: new Set<number>( state.conditions.map( condition => condition.id ) ),
            focusTarget: null,
            keyboardMarquee: null,
            marqueeSeed: null,
        } );
        setProgress( {
            iterations: 0,
            totalIterations: null,
            maxDisp: Number.POSITIVE_INFINITY,
            convergenceThreshold,
            stableFrames: 0,
            stableFramesRequired,
            stopWhenConverged: true,
        } );
        stopRef.current = startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: parameters.stepsPerFrame,
            fastForward: parameters.fastForward,
            physics: {
                springK: parameters.springK,
                equilibriumDist: parameters.equilibriumDist,
                coulombC: parameters.coulombC,
                frictionGamma: parameters.frictionGamma,
                timeStep: parameters.timeStep,
                maxDisplacement: parameters.maxDisplacement,
            },
            stopWhenConverged: true,
            convergenceThreshold,
            stableFramesRequired,
            stopWhenStalled: true,
            stallFramesRequired: 180,
            stallImprovementThreshold: 0.5,
            onProgress: nextProgress => setProgress( nextProgress ),
            onFinish: finishSimulation,
        } );
    };

    useEffect( () => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if ( stopRef.current ) {
                const stop = stopRef.current;
                stopRef.current = null;
                stop();
            }
        };
    }, [] );

    return { progress, runSimulation, stopSimulation };
}
