import React from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";
import { startForcesRun } from "../../../../physics/runForces";
import { type SimParams } from "../../ForcesDialog";

type Props = {
    params: SimParams;
    onOpenDialog: () => void;
    onStopRefChange: ( stop: ( () => void ) | null ) => void;
};

export function SimMenu( { params, onOpenDialog, onStopRefChange }: Props ) {
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const simNodeCount = useAppStore( ( s ) => s.getSimulationSelectedNodes?.().size ?? 0 );
    const canRunForces = simNodeCount > 0 || selActsCount > 0 || selCondsCount > 0;

    const runOnce = () => {
        if ( !canRunForces ) return;
        const physics = {
            springK: params.springK,
            equilibriumDist: params.equilibriumDist,
            coulombC: params.coulombC,
            frictionGamma: params.frictionGamma,
            timeStep: params.timeStep,
            maxDisplacement: params.maxDisplacement,
        };
        const stop = startForcesRun( {
            iterations: params.iterations,
            stepsPerFrame: params.stepsPerFrame,
            fastForward: params.fastForward,
            physics,
        } );
        onStopRefChange( stop );
    };

    const stop = () => {
        // caller reemplazará cualquier stop activo por null
        onStopRefChange( null );
    };

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <button role="menuitem" onClick={ onOpenDialog } title="Adjust simulation parameters" style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Adjust parametersâ€¦
            </button>
            <button role="menuitem" disabled={ !canRunForces } onClick={ runOnce }
                title={ canRunForces ? "Execute a simulation run" : "No items selected for simulation" }
                style={ menuItem }>
                <svg width="18" height="18" viewBox="0 0 24 24"
                    fill={ canRunForces ? "currentColor" : "none" }
                    stroke={ canRunForces ? "none" : "currentColor" }
                    strokeWidth={ canRunForces ? 0 : 2 } aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                </svg>
                Run
            </button>
            <button role="menuitem" onClick={ stop } title="Stop current simulation" style={ { ...menuItem, color: "#7f1d1d" } }>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                </svg>
                Stop
            </button>
        </div>
    );
}


