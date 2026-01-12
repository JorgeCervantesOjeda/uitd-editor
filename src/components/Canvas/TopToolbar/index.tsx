import React, { useRef, useState } from "react";
import type { RefObject } from "react";
import { HelpPanel } from "../HelpPanel";
import { WarningsPanel } from "../WarningsPanel";
import { MenuButton } from "./MenuButton";
import { IconFile, IconEdit, IconExport, IconUtils, IconSim, IconDistribute, IconAlign } from "./icons";
import { FileMenu } from "./menus/FileMenu";
import { EditMenu } from "./menus/EditMenu";
import { ExportMenu } from "./menus/ExportMenu";
import { UtilsMenu } from "./menus/UtilsMenu";
import { SimMenu } from "./menus/SimMenu";
import { DistributeMenu } from "./menus/DistributeMenu";
import { AlignMenu } from "./menus/AlignMenu";
import { ForcesDialog, type SimParams } from "../ForcesDialog";
import { DEFAULT_SIM_PARAMS } from "../../../physics/defaults";
import { useAppStore } from "../../../state/store";

type Props = {
    svgRef: RefObject<SVGSVGElement | null>;
    diagOpen: boolean;
    onToggleDiag: () => void;
};

const SIM_PARAMS_KEY = "uitdl-editor/sim-params";
function loadSimParams(): SimParams {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_KEY );
        if ( !raw ) return DEFAULT_SIM_PARAMS;
        const parsed = JSON.parse( raw ) as Partial<SimParams>;
        return { ...DEFAULT_SIM_PARAMS, ...parsed };
    } catch {
        return DEFAULT_SIM_PARAMS;
    }
}
function saveSimParams( p: SimParams ) {
    try {
        localStorage.setItem( SIM_PARAMS_KEY, JSON.stringify( p ) );
    } catch { /* no-op */ }
}

export function TopToolbar( { svgRef, diagOpen, onToggleDiag }: Props ) {
    const [ params, setParams ] = useState<SimParams>( () => loadSimParams() );
    const [ openDlg, setOpenDlg ] = useState( false );
    const stopRef = useRef<( () => void ) | null>( null );

    // Habilitaciones de menús dependientes de selección
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canDistribute = selNodeCount + selActsCount + selCondsCount >= 3;
    const canAlign = selNodeCount + selActsCount + selCondsCount >= 2;

    // === Copy/Paste a nivel TopToolbar ===
    const selAny = selNodeCount + selActsCount + selCondsCount > 0;
    const copySel = useAppStore( ( s ) => s.copySelectionToClipboard );
    const pasteSel = useAppStore( ( s ) => s.pasteFromClipboard );

    const toolbarActionBtn: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#111827",
        cursor: "pointer",
        userSelect: "none",
        lineHeight: 1,
    };

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
                {/* Archivo */ }
                <MenuButton title="File" icon={ <IconFile /> }>
                    <FileMenu />
                </MenuButton>

                {/* Edit (Undo/Redo) */ }
                <MenuButton title="Edit" icon={ <IconEdit /> }>
                    <EditMenu />
                </MenuButton>

                {/* Copy */ }
                <button
                    type="button"
                    onClick={ () => selAny && copySel() }
                    disabled={ !selAny }
                    title={ selAny ? "Copy selection (Ctrl+C)" : "Select items first" }
                    style={ { ...toolbarActionBtn, ...( selAny ? {} : { opacity: 0.6, cursor: "not-allowed" } ) } }
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

                {/* Paste */ }
                <button
                    type="button"
                    onClick={ () => pasteSel() }
                    title="Paste (Ctrl+V)"
                    style={ toolbarActionBtn }
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

                {/* Export */ }
                <MenuButton title="Export" icon={ <IconExport /> }>
                    <ExportMenu svgRef={ svgRef } />
                </MenuButton>

                {/* Utils */ }
                <MenuButton title="Utils" icon={ <IconUtils /> }>
                    <UtilsMenu />
                </MenuButton>

                {/* Simulation */ }
                <MenuButton title="Simulation" icon={ <IconSim /> }>
                    <SimMenu
                        params={ params }
                        onOpenDialog={ () => setOpenDlg( true ) }
                        onStopRefChange={ ( stop ) => {
                            // si había una corrida previa, detenla
                            if ( stopRef.current ) stopRef.current();
                            stopRef.current = stop;
                        } }
                    />
                </MenuButton>

                {/* Distribute */ }
                <MenuButton title="Distribute" icon={ <IconDistribute /> } disabled={ !canDistribute }>
                    <DistributeMenu />
                </MenuButton>

                {/* Align */ }
                <MenuButton title="Align" icon={ <IconAlign /> } disabled={ !canAlign }>
                    <AlignMenu />
                </MenuButton>

                {/* Separador flexible */ }
                <div style={ { flex: 1 } } />

                {/* Ayuda */ }
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8, marginRight: 16 } }>
                    <HelpPanel />
                </div>

                {/* Diagnóstico */ }
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
                    saveSimParams( p );
                    setOpenDlg( false );
                } }
            />
        </>
    );
}

export default TopToolbar;
