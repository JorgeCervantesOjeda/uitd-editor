// src/components/Canvas/importedDiagramSimulation.ts
// Shares post-UITDL-import container layout, force simulation, progress, and viewport centering.

import { useCallback, useEffect, useRef, useState } from "react";
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

function countOfMovableSimulationItems() {
    const state = useAppStore.getState();
    const simNodes = state.getSimulationSelectedNodes?.() ?? new Set<number>();
    const selActs = state.selectionActions ?? new Set<number>();
    const selConds = state.selectionConds ?? new Set<number>();
    return simNodes.size + selActs.size + selConds.size;
}

export function useImportedDiagramSimulation() {
    const stopRef = useRef<( () => void ) | null>( null );
    const activeRunIdRef = useRef( 0 );
    const isMountedRef = useRef( true );
    const [ progress, setProgress ] = useState<ForcesRunProgress | null>( null );

    const clearSimulationProgress = useCallback( () => {
        if ( isMountedRef.current ) setProgress( null );
    }, [] );

    const cancelActiveSimulation = useCallback( () => {
        activeRunIdRef.current += 1;
        const stop = stopRef.current;
        stopRef.current = null;
        if ( stop ) stop();
        clearSimulationProgress();
    }, [ clearSimulationProgress ] );

    const stopSimulation = useCallback( () => {
        const stop = stopRef.current;
        stopRef.current = null;
        if ( stop ) stop();
        clearSimulationProgress();
    }, [ clearSimulationProgress ] );

    const finishSimulation = useCallback( ( reason: ForcesRunFinishReason, runId: number ) => {
        if ( runId !== activeRunIdRef.current ) return;
        stopRef.current = null;
        clearSimulationProgress();
        useAppStore.getState().clearSelection?.();
        centerImportedDiagramInView();
        if ( reason === "max_iterations" ) {
            window.alert( "The simulation stopped before fully converging." );
        }
        if ( reason === "stalled" ) {
            window.alert( "The simulation stopped because progress stalled." );
        }
    }, [ clearSimulationProgress ] );

    const finishLiveSimulation = useCallback( ( runId: number ) => {
        if ( runId !== activeRunIdRef.current ) return;
        stopRef.current = null;
        clearSimulationProgress();
    }, [ clearSimulationProgress ] );

    const runSimulation = () => {
        cancelActiveSimulation();
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
        if ( countOfMovableSimulationItems() === 0 ) {
            console.info( "Skipped imported UITDL layout simulation because no selected items can move.", {
                cause: "The current simulation selection resolved to zero movable canvas items.",
                fallback: "Keep the imported positions and center the diagram.",
                impact: "No simulation progress dialog is shown.",
            } );
            centerImportedDiagramInView();
            return;
        }

        const runId = activeRunIdRef.current + 1;
        activeRunIdRef.current = runId;
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
            onProgress: nextProgress => {
                if ( runId !== activeRunIdRef.current || !isMountedRef.current ) return;
                setProgress( nextProgress );
            },
            onFinish: reason => finishSimulation( reason, runId ),
        } );
    };

    const runSimulationForCurrentSelection = useCallback( () => {
        cancelActiveSimulation();
        const state = useAppStore.getState();
        const selectedItems =
            state.selection.size +
            state.selectionActions.size +
            state.selectionConds.size;
        if ( selectedItems === 0 ) return;
        if ( countOfMovableSimulationItems() === 0 ) {
            console.info( "Skipped live UITDL layout simulation because the selected text target cannot move.", {
                cause: "The text-to-canvas selection resolved to zero movable canvas items.",
                fallback: "Keep the imported positions without showing simulation progress.",
                impact: "The canvas still updates from UITDL, but layout convergence is skipped.",
            } );
            return;
        }

        const parameters = loadSimulationParameters();
        const convergenceThreshold = 20;
        const stableFramesRequired = 8;
        const runId = activeRunIdRef.current + 1;
        activeRunIdRef.current = runId;
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
            stallFramesRequired: 120,
            stallImprovementThreshold: 0.5,
            onProgress: nextProgress => {
                if ( runId !== activeRunIdRef.current || !isMountedRef.current ) return;
                setProgress( nextProgress );
            },
            onFinish: () => finishLiveSimulation( runId ),
        } );
    }, [ cancelActiveSimulation, finishLiveSimulation ] );

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

    return { progress, runSimulation, runSimulationForCurrentSelection, stopSimulation };
}
