// src/components/Canvas/TopToolbar/menus/SimMenu.tsx
// Provides controls for automatically arranging selected elements.
import React, { useMemo } from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";
import { startForcesRun, type ForcesRunProgress } from "../../../../physics/runForces";
import { type SimParams } from "../../ForcesDialog";
import { buildFragmentGroups } from "../../../../fragments/fragmentModel";

type Props = {
    params: SimParams;
    onOpenDialog: () => void;
    onRequestStartAfterProgressVisible: ( onVisible: () => void ) => void;
    onStopRefChange: ( stop: ( () => void ) | null ) => void;
    onProgressChange: ( progress: ForcesRunProgress | null ) => void;
    onSimulationFinish: () => void;
    onStopRequest: () => void;
};

export function SimMenu( {
    params,
    onOpenDialog,
    onRequestStartAfterProgressVisible,
    onStopRefChange,
    onProgressChange,
    onSimulationFinish,
    onStopRequest,
}: Props ) {
    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );
    const edges = useAppStore( ( s ) => s.edges );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const isCanvasLocked = useAppStore( ( s ) => s.isCanvasLockedByUITDLLiveSync );
    const simNodeCount = useAppStore( ( s ) => s.getSimulationSelectedNodes?.().size ?? 0 );
    const canRunForces = simNodeCount > 0 || selActsCount > 0 || selCondsCount > 0;
    const countOfFragments = useMemo(
        () => buildFragmentGroups( { nodes, actions, conditions, edges } ).length,
        [ nodes, actions, conditions, edges ]
    );
    const canCompactFragments = !isCanvasLocked && countOfFragments >= 2;

    const startRunOnce = () => {
        const physics = {
            springK: params.springK,
            equilibriumDist: params.equilibriumDist,
            actionConditionEquilibriumDist: params.actionConditionEquilibriumDist,
            actionConditionSpringK: params.actionConditionSpringK,
            coulombC: params.coulombC,
            uiCoulombRepulsionFactor: params.uiCoulombRepulsionFactor,
            frictionGamma: params.frictionGamma,
            timeStep: params.timeStep,
            maxDisplacement: params.maxDisplacement,
        };
        const stop = startForcesRun( {
            iterations: params.iterations,
            stepsPerFrame: params.stepsPerFrame,
            fastForward: params.fastForward,
            physics,
            onProgress: onProgressChange,
            onFinish: () => onSimulationFinish(),
        } );
        onStopRefChange( stop );
    };

    const runOnce = () => {
        if ( !canRunForces ) return;
        onStopRequest();
        onProgressChange( {
            iterations: 0,
            totalIterations: Number.isFinite( params.iterations ) ? params.iterations : null,
            maxDisp: Number.POSITIVE_INFINITY,
            convergenceThreshold: 1,
            stableFrames: 0,
            stableFramesRequired: 12,
            stopWhenConverged: false,
        } );
        onRequestStartAfterProgressVisible( startRunOnce );
    };

    const compactFragments = () => useAppStore.getState().compactFragmentsToGrid();

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <button role="menuitem" onClick={ onOpenDialog } title="Adjust arrangement settings" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Arrangement settings
            </button>
            <button
                role="menuitem"
                disabled={ !canCompactFragments }
                onClick={ () => canCompactFragments && compactFragments() }
                title={
                    isCanvasLocked
                        ? "Turn off Live to canvas to compact fragments"
                        : countOfFragments >= 2
                            ? "Arrange fragments in a compact grid only"
                            : "At least two fragments are required"
                }
                style={ { ...menuItem, ...( canCompactFragments ? {} : { opacity: 0.6 } ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                </svg>
                Compact fragments to grid
            </button>
            <button role="menuitem" disabled={ !canRunForces } onClick={ runOnce }
                title={ canRunForces ? "Arrange selected elements automatically" : "Select elements to arrange" }
                style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24"
                    fill={ canRunForces ? "currentColor" : "none" }
                    stroke={ canRunForces ? "none" : "currentColor" }
                    strokeWidth={ canRunForces ? 0 : 2 } aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                </svg>
                Arrange selection
            </button>
            <button role="menuitem" onClick={ onStopRequest } title="Stop arranging" style={ { ...menuItem, color: "#7f1d1d" } }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                </svg>
                Stop arranging
            </button>
        </div>
    );
}

