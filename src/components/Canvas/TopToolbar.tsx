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
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
    const stopRef = useRef<( () => void ) | null>( null );

    const [ params, setParams ] = useState<SimParams>( DEFAULT_SIM_PARAMS );
    const [ openDlg, setOpenDlg ] = useState( false );

    // --- Undo / Redo state ---
    const canUndo = useAppStore( s => s.historyUndo.length > 0 );
    const canRedo = useAppStore( s => s.historyRedo.length > 0 );
    const undo = useAppStore( s => s.undo );
    const redo = useAppStore( s => s.redo );

    // --- Habilitación de simulación ---
    // 1) tamaño de acciones/condiciones (primitivos)
    const selActsCount = useAppStore( s => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( s => s.selectionConds?.size ?? 0 );

    // 2) cantidad de nodos efectivos para simulación (primitivo)
    //    ¡OJO! No guardes el Set ni lo retornes del selector.
    const simNodeCount = useAppStore( s => {
        const fn = s.getSimulationSelectedNodes;
        if ( !fn ) return 0;
        // computa y devuelve el tamaño (número), no el Set
        return fn().size;
    } );

    const canRunForces = ( simNodeCount > 0 ) || ( selActsCount > 0 ) || ( selCondsCount > 0 );

    const runOnce = () => {
        if ( !canRunForces ) return; // guard adicional por seguridad
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
                    position: "relative",
                    margin: "8px 8px 0 8px",
                    zIndex: 1,
                    display: "flex", alignItems: "center", flexWrap: "wrap",
                    gap: 8,
                } }
            >
                {/* === Grupo: Ayuda === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    <HelpPanel />
                </div>

                {/* === Grupo: Archivo (Open/Save) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 40 } }>
                    <FileToolbar />
                </div>

                {/* === Grupo: Undo / Redo === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 60 } }>
                    <button
                        type="button"
                        onClick={ () => canUndo && undo() }
                        disabled={ !canUndo }
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #94a3b8",
                            background: canUndo ? "#f8fafc" : "#e5e7eb",
                            color: canUndo ? "#0f172a" : "#9ca3af",
                            cursor: canUndo ? "pointer" : "default",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                        } }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="9 14 4 9 9 4" />
                            <path d="M20 20a9 9 0 0 0-9-9H4" />
                        </svg>
                        <span style={ { fontSize: 12 } }>Undo</span>
                    </button>

                    <button
                        type="button"
                        onClick={ () => canRedo && redo() }
                        disabled={ !canRedo }
                        title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
                        aria-label="Redo"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #94a3b8",
                            background: canRedo ? "#f8fafc" : "#e5e7eb",
                            color: canRedo ? "#0f172a" : "#9ca3af",
                            cursor: canRedo ? "pointer" : "default",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                        } }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="15 4 20 9 15 14" />
                            <path d="M4 20a9 9 0 0 1 9-9h7" />
                        </svg>
                        <span style={ { fontSize: 12 } }>Redo</span>
                    </button>
                </div>

                {/* === Grupo: Exportar (SVG/JPG) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
                    <ExportToolbar svgRef={ svgRef } />
                </div>

                {/* === Grupo: Utilidades (recolor / clear) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 100 } }>
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1a2 2 0 0 0-2 2v1c0 1.8-1.2 3-3 3z" />
                            <circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" />
                            <circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={ () => {
                            const s = useAppStore.getState();
                            s.resetProjectToBlank?.();
                            s.clearSavedProject?.();
                        } }
                        title="Borrar todo el diagrama"
                        aria-label="Borrar todo el diagrama"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: "1px solid #ef4444",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                    </button>
                </div>

                {/* === Grupo: Simulación (parámetros / run / stop) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 200 } }>
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                    </button>

                    {/* Run Forces — DESACTIVABLE */ }
                    <button
                        type="button"
                        onClick={ runOnce }
                        disabled={ !canRunForces }
                        title={ canRunForces ? "Ejecutar una corrida de simulación" : "No hay nada seleccionado para simular" }
                        aria-label="Ejecutar una corrida de simulación"
                        style={ {
                            padding: 6,
                            borderRadius: 6,
                            border: canRunForces ? "1px solid #334155" : "1px solid #cbd5e1",
                            background: canRunForces ? "#eef2ff" : "#f1f5f9",
                            color: canRunForces ? "#0f172a" : "#9ca3af",
                            cursor: canRunForces ? "pointer" : "default",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        } }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill={ canRunForces ? "currentColor" : "none" }
                            stroke={ canRunForces ? "none" : "currentColor" }
                            strokeWidth={ canRunForces ? 0 : 2 }
                            aria-hidden="true">
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                        </svg>
                    </button>
                </div>

                <div style={ { flex: 1 } } />

                {/* === Diagnóstico === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8 } }>
                    <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } />
                </div>
            </div>

            <ForcesDialog
                open={ openDlg }
                initial={ params }
                onClose={ () => setOpenDlg( false ) }
                onSave={ ( p ) => { setParams( p ); setOpenDlg( false ); } }
            />
        </>
    );
}
