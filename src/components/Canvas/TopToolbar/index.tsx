import React, { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
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
import { DEFAULT_SIM_PARAMS } from "../../../physics/defaults";
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
    const stopRef = useRef<( () => void ) | null>( null );

    const helpButtonRef = useRef<HTMLButtonElement | null>( null );
    const warningsButtonRef = useRef<HTMLButtonElement | null>( null );
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

    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const canDistribute = selNodeCount + selActsCount + selCondsCount >= 3;
    const canAlign = selNodeCount + selActsCount + selCondsCount >= 2;

    const selAny = selNodeCount + selActsCount + selCondsCount > 0;
    const copySel = useAppStore( ( s ) => s.copySelectionToClipboard );
    const pasteSel = useAppStore( ( s ) => s.pasteFromClipboard );

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
                    paddingRight: 340,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                } }
            >
                <div style={ { pointerEvents: "auto", display: "flex", gap: 8 } }>
                    <HelpPanel triggerRef={ helpButtonRef } />
                </div>

                <MenuButton ref={ fileMenuRef } title="File" icon={ <IconFile /> }>
                    <FileMenu onRequestClose={ () => fileMenuRef.current?.closeMenu( true ) } />
                </MenuButton>

                <MenuButton ref={ editMenuRef } title="Edit" icon={ <IconEdit /> }>
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
                    onClick={ () => pasteSel() }
                    title="Paste (Ctrl+V, Alt+P)"
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
                        onStopRefChange={ ( stop ) => {
                            if ( stopRef.current ) stopRef.current();
                            stopRef.current = stop;
                        } }
                    />
                </MenuButton>

                <MenuButton
                    ref={ distributeMenuRef }
                    title="Distribute"
                    icon={ <IconDistribute /> }
                    disabled={ !canDistribute }
                >
                    <DistributeMenu />
                </MenuButton>

                <MenuButton ref={ alignMenuRef } title="Align" icon={ <IconAlign /> } disabled={ !canAlign }>
                    <AlignMenu />
                </MenuButton>
            </div>

            <WarningsPanel open={ diagOpen } onToggle={ onToggleDiag } triggerRef={ warningsButtonRef } />

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

