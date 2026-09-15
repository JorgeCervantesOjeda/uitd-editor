// src/components/Canvas/TopToolbar/index.tsx
// Renders the canvas toolbar and coordinates its menus and dialogs.

import React, { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Brain } from "lucide-react";
import { AiReviewPanel } from "../AiReviewPanel";
import { HelpPanel } from "../HelpPanel";
import { WarningsPanel } from "../WarningsPanel";
import { MenuButton, type MenuButtonHandle } from "./MenuButton";
import {
    IconFile,
    IconEdit,
    IconExport,
    IconUtils,
    IconSim,
    IconDistribute,
    IconAlign,
} from "./icons";
import { FileMenu } from "./menus/FileMenu";
import { EditMenu } from "./menus/EditMenu";
import { ExportMenu } from "./menus/ExportMenu";
import { UtilsMenu } from "./menus/UtilsMenu";
import { SimMenu } from "./menus/SimMenu";
import { DistributeMenu } from "./menus/DistributeMenu";
import { AlignMenu } from "./menus/AlignMenu";
import { ForcesDialog, type SimParams } from "../ForcesDialog";
import { SimulationProgressDialog } from "../SimulationProgressDialog";
import { DEFAULT_SIM_PARAMS } from "../../../physics/defaults";
import type { ForcesRunProgress } from "../../../physics/runForces";
import {
    sanitizeSimParams,
    SIM_PARAMS_STORAGE_KEY,
} from "../../../physics/simParamsStorage";
import { useAppStore } from "../../../state/store";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

function loadSimParams(): SimParams {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_STORAGE_KEY );
        if ( !raw ) return DEFAULT_SIM_PARAMS;
        const parsed = JSON.parse( raw ) as unknown;
        return sanitizeSimParams( parsed, DEFAULT_SIM_PARAMS );
    } catch {
        return DEFAULT_SIM_PARAMS;
    }
}

function saveSimParams( p: SimParams ) {
    try {
        localStorage.setItem( SIM_PARAMS_STORAGE_KEY, JSON.stringify( p ) );
    } catch {
        // no-op
    }
}

function isTypingTarget( target: EventTarget | null ) {
    if ( !( target instanceof Element ) ) return false;
    if ( target instanceof HTMLElement && target.isContentEditable ) return true;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
}

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
    const [ params, setParams ] = useState<SimParams>( () => loadSimParams() );
    const [ openDlg, setOpenDlg ] = useState( false );
    const [ aiReviewOpen, setAiReviewOpen ] = useState( false );
    const [ simulationProgress, setSimulationProgress ] = useState<ForcesRunProgress | null>( null );
    const stopRef = useRef<( () => void ) | null>( null );

    const helpButtonRef = useRef<HTMLButtonElement | null>( null );
    const warningsButtonRef = useRef<HTMLButtonElement | null>( null );
    const aiReviewButtonRef = useRef<HTMLButtonElement | null>( null );
    const copyButtonRef = useRef<HTMLButtonElement | null>( null );
    const pasteButtonRef = useRef<HTMLButtonElement | null>( null );

    const fileMenuRef = useRef<MenuButtonHandle | null>( null );
    const editMenuRef = useRef<MenuButtonHandle | null>( null );
    const exportMenuRef = useRef<MenuButtonHandle | null>( null );
    const utilsMenuRef = useRef<MenuButtonHandle | null>( null );
    const simulationMenuRef = useRef<MenuButtonHandle | null>( null );
    const distributeMenuRef = useRef<MenuButtonHandle | null>( null );
    const alignMenuRef = useRef<MenuButtonHandle | null>( null );

    useEffect( () => {
        return () => {
            if ( stopRef.current ) {
                stopRef.current();
                stopRef.current = null;
            }
        };
    }, [] );

    const stopManualSimulation = () => {
        const stop = stopRef.current;
        stopRef.current = null;
        if ( stop ) stop();
        setSimulationProgress( null );
    };

    const clearManualSimulation = () => {
        stopRef.current = null;
        setSimulationProgress( null );
    };

    const setManualSimulationStop = ( stop: ( () => void ) | null ) => {
        if ( stopRef.current ) stopRef.current();
        stopRef.current = stop;
    };

    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canDistribute = selNodeCount + selActsCount + selCondsCount >= 3;
    const canAlign = selNodeCount + selActsCount + selCondsCount >= 2;

    const selAny = selNodeCount + selActsCount + selCondsCount > 0;
    const copySel = useAppStore( ( s ) => s.copySelectionToClipboard );
    const pasteSel = useAppStore( ( s ) => s.pasteFromClipboard );
    const canvasDark = useAppStore( ( s ) => s.canvasDark );
    const isCanvasLocked = useAppStore( ( s ) => s.isCanvasLockedByUITDLLiveSync );

    useEffect( () => {
        function onAltShortcut( e: KeyboardEvent ) {
            if ( !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ) return;
            if ( isTypingTarget( e.target ) ) return;
            if ( openDlg ) return;

            const key = e.key.toLowerCase();
            const handlers: Record<string, () => void> = {
                h: () => helpButtonRef.current?.click(),
                f: () => fileMenuRef.current?.openMenu( "first" ),
                e: () => editMenuRef.current?.openMenu( "first" ),
                c: () => copyButtonRef.current?.click(),
                p: () => pasteButtonRef.current?.click(),
                x: () => exportMenuRef.current?.openMenu( "first" ),
                u: () => utilsMenuRef.current?.openMenu( "first" ),
                s: () => simulationMenuRef.current?.openMenu( "first" ),
                i: () => aiReviewButtonRef.current?.click(),
                d: () => distributeMenuRef.current?.openMenu( "first" ),
                a: () => alignMenuRef.current?.openMenu( "first" ),
                v: () => warningsButtonRef.current?.click(),
            };
            const handler = handlers[ key ];
            if ( !handler ) return;
            e.preventDefault();
            handler();
        }

        document.addEventListener( "keydown", onAltShortcut );
        return () => document.removeEventListener( "keydown", onAltShortcut );
    }, [ openDlg ] );

    const toolbarActionBtn: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${canvasDark ? "#475569" : "#e5e7eb"}`,
        background: canvasDark ? "#1e293b" : "#ffffff",
        color: canvasDark ? "#e2e8f0" : "#111827",
        cursor: "pointer",
        userSelect: "none",
        lineHeight: 1,
    };

    const aiReviewToolbarBtn: React.CSSProperties = {
        ...toolbarActionBtn,
        marginLeft: "auto",
        border: "1px solid #22c55e",
        background: canvasDark ? "#14532d" : "#dcfce7",
        color: canvasDark ? "#ecfdf5" : "#14532d",
        boxShadow: canvasDark
            ? "0 0 0 2px rgba(34,197,94,0.18)"
            : "0 0 0 2px rgba(34,197,94,0.16)",
        fontWeight: 800,
    };

    return (
        <>
            <div
                className="topToolbar"
                style={ {
                    position: "relative",
                    margin: "8px 8px 0 8px",
                    paddingRight: 340,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                } }
            >
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8 } }>
                    <HelpPanel
                        triggerRef={ helpButtonRef }
                        onOpenAiReview={ () => setAiReviewOpen( true ) }
                    />
                </div>

                <MenuButton ref={ fileMenuRef } title="File" icon={ <IconFile /> }>
                    <FileMenu
                        onRequestClose={ () => fileMenuRef.current?.closeMenu( true ) }
                        readOnly={ isCanvasLocked }
                    />
                </MenuButton>

                <MenuButton ref={ editMenuRef } title="Edit" icon={ <IconEdit /> } disabled={ isCanvasLocked }>
                    <EditMenu />
                </MenuButton>

                <button
                    ref={ copyButtonRef }
                    type="button"
                    onClick={ () => selAny && copySel() }
                    disabled={ !selAny }
                    title={ selAny ? "Copy selection (Ctrl+C, Alt+C)" : "Select items first" }
                    style={ {
                        ...toolbarActionBtn,
                        ...( selAny ? {} : { opacity: 0.6, cursor: "not-allowed" } ),
                    } }
                >
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
                    >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <rect x="3" y="3" width="13" height="13" rx="2" />
                    </svg>
                    Copy
                </button>

                <button
                    ref={ pasteButtonRef }
                    type="button"
                    onClick={ () => !isCanvasLocked && pasteSel() }
                    disabled={ isCanvasLocked }
                    title={ isCanvasLocked ? "Turn off Live to canvas to paste" : "Paste (Ctrl+V, Alt+P)" }
                    style={ {
                        ...toolbarActionBtn,
                        ...( isCanvasLocked ? { opacity: 0.6, cursor: "not-allowed" } : {} ),
                    } }
                >
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
                    >
                        <path d="M19 20H5a2 2 0 0 1-2-2V7h18v11a2 2 0 0 1-2 2Z" />
                        <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                    </svg>
                    Paste
                </button>

                <MenuButton ref={ exportMenuRef } title="Export" icon={ <IconExport /> }>
                    <ExportMenu svgRef={ svgRef } />
                </MenuButton>

                <MenuButton ref={ utilsMenuRef } title="Utils" icon={ <IconUtils /> }>
                    <UtilsMenu />
                </MenuButton>

                <MenuButton ref={ simulationMenuRef } title="Simulation" icon={ <IconSim /> }>
                    <SimMenu
                        params={ params }
                        onOpenDialog={ () => setOpenDlg( true ) }
                        onStopRefChange={ setManualSimulationStop }
                        onProgressChange={ setSimulationProgress }
                        onSimulationFinish={ clearManualSimulation }
                        onStopRequest={ stopManualSimulation }
                    />
                </MenuButton>

                <MenuButton
                    ref={ distributeMenuRef }
                    title="Distribute"
                    icon={ <IconDistribute /> }
                    disabled={ isCanvasLocked || !canDistribute }
                >
                    <DistributeMenu />
                </MenuButton>

                <MenuButton ref={ alignMenuRef } title="Align" icon={ <IconAlign /> } disabled={ isCanvasLocked || !canAlign }>
                    <AlignMenu />
                </MenuButton>

                <button
                    ref={ aiReviewButtonRef }
                    type="button"
                    onClick={ () => setAiReviewOpen( true ) }
                    title="Copy AI help prompt (Alt+I)"
                    style={ aiReviewToolbarBtn }
                >
                    <Brain size={ 18 } aria-hidden="true" />
                    AI help
                    <span
                        aria-label="New"
                        style={ {
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: canvasDark ? "#bbf7d0" : "#16a34a",
                            color: canvasDark ? "#14532d" : "#ffffff",
                            fontSize: 11,
                            lineHeight: 1.2,
                        } }
                    >
                        New
                    </span>
                </button>
            </div>

            <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } triggerRef={ warningsButtonRef } />
            <AiReviewPanel
                open={ aiReviewOpen }
                onClose={ () => setAiReviewOpen( false ) }
                triggerRef={ aiReviewButtonRef }
            />

            <ForcesDialog
                open={ openDlg }
                initial={ params }
                onClose={ () => setOpenDlg( false ) }
                onSave={ ( p ) => {
                    setParams( p );
                    saveSimParams( p );
                    setOpenDlg( false );
                } }
            />
            <SimulationProgressDialog
                open={ simulationProgress != null }
                progress={ simulationProgress }
                onStop={ stopManualSimulation }
            />
        </>
    );
}

export default TopToolbar;

