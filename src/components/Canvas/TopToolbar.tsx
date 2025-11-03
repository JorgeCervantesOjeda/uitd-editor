// src/components/Canvas/TopToolbar.tsx
import React, { useRef, useState } from "react";
import type { RefObject } from "react";
import { FileToolbar } from "./FileToolbar";
import { HelpPanel } from "./HelpPanel";
import { ExportToolbar } from "./ExportToolbar";
import { WarningsPanel } from "./WarningsPanel";
import { useAppStore } from "../../state/store";
import { startForcesRun } from "../../physics/runForces";
import { ForcesDialog, type SimParams } from "./ForcesDialog";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

const DEFAULT_PARAMS: SimParams = {
    iterations: 600,
    stepsPerFrame: 10,
    fastForward: 30,
    springK: 1e-4,
    equilibriumDist: 140,
    coulombC: 1200,
    frictionGamma: 0.2,
    timeStep: 1,
    maxDisplacement: 50,
};

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
    const stopRef = useRef<( () => void ) | null>( null );

    const [ params, setParams ] = useState<SimParams>( DEFAULT_PARAMS );
    const [ openDlg, setOpenDlg ] = useState( false );

    const runOnce = () => {
        // detener corrida previa (si existe)
        if ( stopRef.current ) { stopRef.current(); stopRef.current = null; }

        // mapear a opciones del motor
        const physics = {
            springK: params.springK,
            equilibriumDist: params.equilibriumDist,
            coulombC: params.coulombC,
            frictionGamma: params.frictionGamma,
            timeStep: params.timeStep,
            maxDisplacement: params.maxDisplacement,
        };

        stopRef.current = startForcesRun( {
            iterations: params.iterations,
            stepsPerFrame: params.stepsPerFrame,
            fastForward: params.fastForward,
            physics,
        } );
    };

    const stop = () => {
        if ( stopRef.current ) { stopRef.current(); stopRef.current = null; }
    };

    return (
        <>
            <div
                style={ {
                    position: "fixed",
                    top: 8, left: 8, right: 8, zIndex: 70,
                    display: "flex", alignItems: "center", flexWrap: "wrap",
                    pointerEvents: "none",
                } }
            >
                {/* === Grupo: Ayuda === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    <HelpPanel />
                </div>

                {/* === Grupo: Archivo (Open/Save) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    <FileToolbar />
                </div>

                {/* === Grupo: Exportar (SVG/JPG) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    <ExportToolbar svgRef={ svgRef } />
                </div>

                {/* === Grupo: Utilidades (recolor) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    {/* Recolor Nodes */ }
                    <button
                        type="button"
                        onClick={ () => useAppStore.getState().recolorAllNodesRandomly?.() }
                        title="Recolorear nodos por displayId"
                        aria-label="Recolorear nodos por displayId"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #94a3b8",
                            background: "#f8fafc",
                            color: "#0f172a",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        {/* Icono: paleta */ }
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1a2 2 0 0 0-2 2v1c0 1.8-1.2 3-3 3z" />
                            <circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" />
                            <circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
                        </svg>
                    </button>
                </div>

                {/* === Grupo: Simulación (parámetros / run / stop) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 200 } }>
                    {/* Abrir parámetros (Sim Params) */ }
                    <button
                        type="button"
                        onClick={ () => setOpenDlg( true ) }
                        title="Ajustar parámetros de la simulación"
                        aria-label="Ajustar parámetros de la simulación"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #64748b",
                            background: "#f1f5f9",
                            color: "#0f172a",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        {/* Icono: sliders (ajustes) */ }
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                    </button>

                    {/* Run Forces */ }
                    <button
                        type="button"
                        onClick={ runOnce }
                        title="Ejecutar una corrida de simulación"
                        aria-label="Ejecutar una corrida de simulación"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #334155",
                            background: "#eef2ff",
                            color: "#0f172a",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        {/* Icono: play */ }
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>

                    {/* Stop */ }
                    <button
                        type="button"
                        onClick={ stop }
                        title="Detener simulación en curso"
                        aria-label="Detener simulación en curso"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #ef4444",
                            background: "#fff1f2",
                            color: "#7f1d1d",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        {/* Icono: stop (cuadro) */ }
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                        </svg>
                    </button>
                </div>

                {/* Empuja diagnóstico al extremo derecho */ }
                <div style={ { flex: 1 } } />

                {/* === Grupo: Diagnóstico === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8 } }>
                    <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } />
                </div>
            </div>

            {/* Popup de parámetros */ }
            <ForcesDialog
                open={ openDlg }
                initial={ params }
                onClose={ () => setOpenDlg( false ) }
                onSave={ ( p ) => { setParams( p ); setOpenDlg( false ); } }
            />
        </>
    );
}
