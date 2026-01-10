import React, { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { FileToolbar } from "./FileToolbar";
import { HelpPanel } from "./HelpPanel";
import { ExportToolbar } from "./ExportToolbar";
import { WarningsPanel } from "./WarningsPanel";
import { useAppStore } from "../../state/store";
import { startForcesRun } from "../../physics/runForces";
import { ForcesDialog, type SimParams } from "./ForcesDialog";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";

const SIM_PARAMS_KEY = "uitdl-editor/sim-params";

function loadSimParams(): SimParams {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_KEY );
        if ( !raw ) return DEFAULT_SIM_PARAMS;
        const parsed = JSON.parse( raw ) as Partial<SimParams>;
        // Mezcla con defaults por si agregas campos nuevos más adelante
        return { ...DEFAULT_SIM_PARAMS, ...parsed };
    } catch {
        return DEFAULT_SIM_PARAMS;
    }
}

function saveSimParams( p: SimParams ) {
    try {
        localStorage.setItem( SIM_PARAMS_KEY, JSON.stringify( p ) );
    } catch {
        // no-op
    }
}

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

// Ícono que usabas para ExportUITDL (ajusta sus paths si eran otros)
function UITDLIcon( props: React.SVGProps<SVGSVGElement> ) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            { ...props }
        >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
    );
}

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
    const stopRef = useRef<( () => void ) | null>( null );

    const [ params, setParams ] = useState<SimParams>( () => loadSimParams() );
    const [ openDlg, setOpenDlg ] = useState( false );

    // --- Undo / Redo state ---
    const canUndo = useAppStore( ( s ) => s.historyUndo.length > 0 );
    const canRedo = useAppStore( ( s ) => s.historyRedo.length > 0 );
    const undo = useAppStore( ( s ) => s.undo );
    const redo = useAppStore( ( s ) => s.redo );

    // --- Distribución / Alineación ---
    const distributeH = useAppStore( ( s ) => s.distributeSelectedHorizontally );
    const distributeV = useAppStore( ( s ) => s.distributeSelectedVertically );
    const alignLeft = useAppStore( ( s ) => s.alignLeft );
    const alignCenterX = useAppStore( ( s ) => s.alignCenterX );
    const alignRight = useAppStore( ( s ) => s.alignRight );
    const alignTop = useAppStore( ( s ) => s.alignTop );
    const alignMiddleY = useAppStore( ( s ) => s.alignMiddleY );
    const alignBottom = useAppStore( ( s ) => s.alignBottom );

    // --- Selección / habilitaciones ---
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canDistribute = selNodeCount + selActsCount + selCondsCount >= 3;
    const canAlign = selNodeCount + selActsCount + selCondsCount >= 2;

    // --- Habilitación de simulación ---
    const simNodeCount = useAppStore( ( s ) => {
        const fn = s.getSimulationSelectedNodes;
        if ( !fn ) return 0;
        return fn().size;
    } );
    const canRunForces = simNodeCount > 0 || selActsCount > 0 || selCondsCount > 0;

    const runOnce = () => {
        if ( !canRunForces ) return;
        if ( stopRef.current ) {
            stopRef.current();
            stopRef.current = null;
        }
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
        if ( stopRef.current ) {
            stopRef.current();
            stopRef.current = null;
        }
    };

    // --- Utils (recolor / clear) ---
    const recolorAll = () => useAppStore.getState().recolorAllNodesRandomly?.();
    const clearAll = () => {
        const s = useAppStore.getState();
        s.resetProjectToBlank?.();
        s.clearSavedProject?.();
    };

    // --- Submenús (estado) ---
    const [ openFile, setOpenFile ] = useState( false );
    const [ openEdit, setOpenEdit ] = useState( false );
    const [ openExport, setOpenExport ] = useState( false );
    const [ openUtils, setOpenUtils ] = useState( false );
    const [ openSim, setOpenSim ] = useState( false );
    const [ openDistribute, setOpenDistribute ] = useState( false );
    const [ openAlign, setOpenAlign ] = useState( false );

    // refs para outside-click
    const fileRef = useRef<HTMLDivElement | null>( null );
    const editRef = useRef<HTMLDivElement | null>( null );
    const exportRef = useRef<HTMLDivElement | null>( null );
    const utilsRef = useRef<HTMLDivElement | null>( null );
    const simRef = useRef<HTMLDivElement | null>( null );
    const distRef = useRef<HTMLDivElement | null>( null );
    const alignRef = useRef<HTMLDivElement | null>( null );

    // helpers abrir-solo-uno / cerrar-todos
    const closeAllMenus = () => {
        setOpenFile( false );
        setOpenEdit( false );
        setOpenExport( false );
        setOpenUtils( false );
        setOpenSim( false );
        setOpenDistribute( false );
        setOpenAlign( false );
    };
    const openOnly = ( which:
        | "file" | "edit" | "export" | "utils" | "sim" | "dist" | "align" ) => {
        setOpenFile( which === "file" );
        setOpenEdit( which === "edit" );
        setOpenExport( which === "export" );
        setOpenUtils( which === "utils" );
        setOpenSim( which === "sim" );
        setOpenDistribute( which === "dist" );
        setOpenAlign( which === "align" );
    };

    // Outside click handler
    useEffect( () => {
        function onDocClick( e: MouseEvent ) {
            const targets = [
                fileRef.current,
                editRef.current,
                exportRef.current,
                utilsRef.current,
                simRef.current,
                distRef.current,
                alignRef.current,
            ];
            const targetNode = e.target as Node | null;
            const clickedInside = targets.some(
                ( wrap ) => wrap && targetNode ? wrap.contains( targetNode ) : false
            );
            if ( !clickedInside ) closeAllMenus();
        }
        document.addEventListener( "click", onDocClick );
        return () => document.removeEventListener( "click", onDocClick );
    }, [] );

    // --- Estilos comunes ---
    const btn = ( enabled = true, accent = "#64748b" ) => ( {
        padding: 6,
        borderRadius: 6,
        border: `1px solid ${enabled ? accent : "#cbd5e1"}`,
        background: enabled ? "#f8fafc" : "#f1f5f9",
        color: enabled ? "#0f172a" : "#9ca3af",
        cursor: enabled ? "pointer" : "default",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
    } );
    const menu = {
        position: "absolute" as const,
        top: "110%",
        left: 0,
        zIndex: 1000,
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        padding: 6,
        minWidth: 130,
        overflow: "visible" as const,
    };
    const menuItem = {
        textAlign: "left" as const,
        padding: "6px 8px",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 8,
    };

    // Export UITDL (vive SOLO en Exportar)
    function exportUITDL() {
        const s = useAppStore.getState();
        const payload = {
            nodes: s.nodes,
            actions: s.actions,
            conditions: s.conditions,
            edges: s.edges,
            panzoom: s.panzoom,
            viewBox: s.viewBox,
        };
        const json = JSON.stringify( payload, null, 2 );
        const blob = new Blob( [ json ], { type: "application/json" } );
        const a = document.createElement( "a" );
        const url = URL.createObjectURL( blob );
        a.href = url;
        a.download = "diagram.uitdl.json";
        document.body.appendChild( a );
        a.click();
        document.body.removeChild( a );
        URL.revokeObjectURL( url );
    }

    return (
        <>
            <div
                style={ {
                    position: "relative",
                    margin: "8px 8px 0 8px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                } }
            >
                {/* === Archivo (submenú) === */ }
                <div ref={ fileRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "file" );
                            }
                        } }
                        title="File"
                        aria-haspopup="menu"
                        aria-expanded={ openFile }
                        style={ btn( true ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                        </svg>
                        File ▾
                    </button>
                    { openFile && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { padding: 4, width: 70 } }>
                                {/* Asegúrate de eliminar “Exportar UITDL” dentro de FileToolbar.tsx */ }
                                <FileToolbar />
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Editar (submenú) === */ }
                <div ref={ editRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "edit" );
                            }
                        } }
                        title="Edit"
                        aria-haspopup="menu"
                        aria-expanded={ openEdit }
                        style={ btn( true ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                        Edit ▾
                    </button>
                    { openEdit && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { display: "grid", gap: 4, width: 50} }>
                                <button
                                    role="menuitem"
                                    disabled={ !canUndo }
                                    onClick={ () => { if ( canUndo ) undo(); closeAllMenus(); } }
                                    title="Undo (Ctrl+Z)"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="9 14 4 9 9 4" />
                                        <path d="M20 20a9 9 0 0 0-9-9H4" />
                                    </svg>
                                    Undo
                                </button>
                                <button
                                    role="menuitem"
                                    disabled={ !canRedo }
                                    onClick={ () => { if ( canRedo ) redo(); closeAllMenus(); } }
                                    title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="15 4 20 9 15 14" />
                                        <path d="M4 20a9 9 0 0 1 9-9h7" />
                                    </svg>
                                    Redo
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Exportar (submenú) — botón con ícono UITDL === */ }
                <div ref={ exportRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "export" );
                            }
                        } }
                        title="Export"
                        aria-haspopup="menu"
                        aria-expanded={ openExport }
                        style={ btn( true ) }
                    >
                        <UITDLIcon />
                        Export ▾
                    </button>
                    { openExport && (
                        <div
                            role="menu"
                            style={ { ...menu, minWidth: 110 } }
                            onClick={ ( e ) => e.stopPropagation() }
                        >
                            <div style={ { padding: 4, display: "grid", gap: 6 } }>
                                <ExportToolbar svgRef={ svgRef } />
                                {/* Exportar UITDL vive aquí (ícono textual UITDL) */ }
                                <button
                                    type="button"
                                    onClick={ () => { exportUITDL(); closeAllMenus(); } }
                                    title="Export UITDL"
                                    style={ { ...menuItem, justifyContent: "flex-start" } }
                                >
                                    <span style={ { fontWeight: 700, letterSpacing: 0.5 } }>UITDL</span>
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Utilidades (submenú) === */ }
                <div ref={ utilsRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "utils" );
                            }
                        } }
                        title="Utils"
                        aria-haspopup="menu"
                        aria-expanded={ openUtils }
                        style={ btn( true ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                        Utils ▾
                    </button>
                    { openUtils && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { display: "grid", gap: 4 } }>
                                <button
                                    role="menuitem"
                                    onClick={ () => { recolorAll(); closeAllMenus(); } }
                                    title="Recolor nodes by displayId"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1a2 2 0 0 0-2 2v1c0 1.8-1.2 3-3 3z" />
                                        <circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" />
                                        <circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
                                    </svg>
                                    Recolor nodes by displayId
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={ () => { clearAll(); closeAllMenus(); } }
                                    title="Delete all the diagram"
                                    style={ { ...menuItem, color: "#b91c1c" } }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                    Delete all the diagram
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Simulación (submenú) === */ }
                <div ref={ simRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "sim" );
                            }
                        } }
                        title="Simulation"
                        aria-haspopup="menu"
                        aria-expanded={ openSim }
                        style={ btn( true ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                            <line x1="17" y1="16" x2="23" y2="16" />
                        </svg>
                        Simulation ▾
                    </button>
                    { openSim && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { display: "grid", gap: 4 } }>
                                <button
                                    role="menuitem"
                                    onClick={ () => { setOpenDlg( true ); closeAllMenus(); } }
                                    title="Adjust simulation parameters"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                                        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                                        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                                        <line x1="17" y1="16" x2="23" y2="16" />
                                    </svg>
                                    Adjust parameters…
                                </button>
                                <button
                                    role="menuitem"
                                    disabled={ !canRunForces }
                                    onClick={ () => { runOnce(); closeAllMenus(); } }
                                    title={ canRunForces ? "Execute a simulation run" : "No items selected for simulation" }
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24"
                                        fill={ canRunForces ? "currentColor" : "none" }
                                        stroke={ canRunForces ? "none" : "currentColor" }
                                        strokeWidth={ canRunForces ? 0 : 2 }
                                        aria-hidden="true">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    Run
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={ () => { stop(); closeAllMenus(); } }
                                    title="Stop current simulation"
                                    style={ { ...menuItem, color: "#7f1d1d" } }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                                    </svg>
                                    Stop
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Distribuir (submenú) === */ }
                <div ref={ distRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "dist" );
                            }
                        } }
                        disabled={ !canDistribute }
                        title="Distribute elements"
                        aria-haspopup="menu"
                        aria-expanded={ openDistribute }
                        style={ btn( canDistribute ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h6M3 12h12M3 18h6" />
                        </svg>
                        Distribute ▾
                    </button>
                    { openDistribute && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { display: "grid", gap: 4 } }>
                                <button
                                    role="menuitem"
                                    disabled={ !canDistribute }
                                    onClick={ () => { distributeH(); closeAllMenus(); } }
                                    title="Distribute horizontally"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 6v12M20 6v12" />
                                        <rect x="7" y="8" width="3" height="8" />
                                        <rect x="14" y="8" width="3" height="8" />
                                    </svg>
                                    Horizontal (centers)
                                </button>
                                <button
                                    role="menuitem"
                                    disabled={ !canDistribute }
                                    onClick={ () => { distributeV(); closeAllMenus(); } }
                                    title="Distribute vertically"
                                    style={ menuItem }
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M6 4h12M6 20h12" />
                                        <rect x="8" y="7" width="8" height="3" />
                                        <rect x="8" y="14" width="8" height="3" />
                                    </svg>
                                    Vertical (centers)
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* === Alinear (submenú) === */ }
                <div ref={ alignRef } style={ { position: "relative", pointerEvents: "auto" } }>
                    <button
                        type="button"
                        onClick={ ( e ) => {
                            e.stopPropagation();
                            if ( openFile ) {
                                closeAllMenus();
                            } else {
                                openOnly( "align" );
                            }
                        } }
                        disabled={ !canAlign }
                        title="Align elements"
                        aria-haspopup="menu"
                        aria-expanded={ openAlign }
                        style={ btn( canAlign ) }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M3 12h12M3 18h18" />
                        </svg>
                        Align ▾
                    </button>
                    { openAlign && (
                        <div role="menu" style={ menu } onClick={ ( e ) => e.stopPropagation() }>
                            <div style={ { display: "grid", gap: 4 } }>
                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignLeft(); closeAllMenus(); } }
                                    title="Align to the left (edges)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M3 6v12" /><rect x="5" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                                    </svg>
                                    Left
                                </button>
                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignCenterX(); closeAllMenus(); } }
                                    title="Center horizontally (centers X)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M12 6v12" /><rect x="7" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                                    </svg>
                                    Center horizontally
                                </button>
                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignRight(); closeAllMenus(); } }
                                    title="Align to the right (edges)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M21 6v12" /><rect x="9" y="7" width="10" height="3" /><rect x="5" y="14" width="14" height="3" />
                                    </svg>
                                    Right
                                </button>

                                <hr style={ { border: 0, borderTop: "1px solid #e5e7eb", margin: "6px 0" } } />

                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignTop(); closeAllMenus(); } }
                                    title="Align to the top (edges)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M6 3h12" /><rect x="7" y="5" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                                    </svg>
                                    Top
                                </button>
                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignMiddleY(); closeAllMenus(); } }
                                    title="Center vertically (centers Y)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M6 12h12" /><rect x="7" y="7" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                                    </svg>
                                    Center vertically
                                </button>
                                <button role="menuitem" disabled={ !canAlign } onClick={ () => { alignBottom(); closeAllMenus(); } }
                                    title="Align to the bottom (edges)" style={ menuItem }>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M6 21h12" /><rect x="7" y="9" width="3" height="10" /><rect x="14" y="5" width="3" height="14" />
                                    </svg>
                                    Bottom
                                </button>
                            </div>
                        </div>
                    ) }
                </div>

                {/* Separador flexible */ }
                <div style={ { flex: 1 } } />

                {/* === Ayuda (SIN submenú) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 16 } }>
                    <HelpPanel />
                </div>

                {/* === Diagnóstico (SIN submenú) === */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8 } }>
                    <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } />
                </div>
            </div>

            <ForcesDialog
                open={ openDlg }
                initial={ params }
                onClose={ () => setOpenDlg( false ) }
                onSave={ ( p ) => {
                    setParams( p );
                    saveSimParams( p );   // ← persistir
                    setOpenDlg( false );
                } }
            />
        </>
    );
}
