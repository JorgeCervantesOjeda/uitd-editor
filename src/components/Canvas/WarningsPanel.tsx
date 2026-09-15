// src/components/Canvas/WarningsPanel.tsx
import React, { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useAppStore } from "../../state/store";
import {
    validateDiagram,
    type DiagramIssue,
    type IssueRef,
} from "../../validation/diagramValidation";
import { formatValidationIssuesForClipboard } from "./WarningsPanelClipboard";

type Props = {
    open: boolean;
    onToggle: () => void;
    triggerRef?: RefObject<HTMLButtonElement | null>;
};

const kindColor = ( k: "error" | "warning" ) =>
    k === "error" ? "#ff6b6b" : "#f4c430";

const kindLabel = ( k: "error" | "warning" ) =>
    k === "error" ? "Errors" : "Warnings";

const refLabel = ( ref?: IssueRef ): string => {
    if ( !ref ) return "";
    switch ( ref.kind ) {
        case "node":
            return `UI ${ref.id}`;
        case "action":
            return `Action ${ref.id}`;
        case "condition":
            return `Condition ${ref.id}`;
        default:
            return "";
    }
};

const issueRefLabel = ( issue: DiagramIssue ): string =>
    issue.refLabel ?? refLabel( issue.ref );

type CopyStatus = "idle" | "copied" | "failed";

export const WarningsPanel: React.FC<Props> = ( { open, onToggle, triggerRef } ) => {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const fragmentTitles = useAppStore( s => s.fragmentTitles );

    const selectSingleOrKeep = useAppStore( s => s.selectSingleOrKeep );
    const selectSingleOrKeepAction = useAppStore(
        s => s.selectSingleOrKeepAction,
    );
    const selectSingleOrKeepCondition = useAppStore(
        s => s.selectSingleOrKeepCondition,
    );

    const panelRef = useRef<HTMLDivElement | null>( null );
    const [ hoverIssueKey, setHoverIssueKey ] = useState<string | null>( null );
    const [ activeIssueKey, setActiveIssueKey ] = useState<string | null>( null );
    const [ copyStatus, setCopyStatus ] = useState<CopyStatus>( "idle" );

    const issues: DiagramIssue[] = useMemo(
        () =>
            validateDiagram( {
                nodes,
                actions,
                conditions,
                edges,
                fragmentTitles,
            } ),
        [ nodes, actions, conditions, edges, fragmentTitles ],
    );

    useEffect( () => {
        if ( !open ) return;
        function onKeyDown( e: KeyboardEvent ) {
            if ( e.key !== "Escape" ) return;
            e.preventDefault();
            onToggle();
            requestAnimationFrame( () => triggerRef?.current?.focus() );
        }
        document.addEventListener( "keydown", onKeyDown, true );
        return () => document.removeEventListener( "keydown", onKeyDown, true );
    }, [ onToggle, open, triggerRef ] );

    const errorCount = issues.filter( i => i.kind === "error" ).length;
    const warningCount = issues.filter( i => i.kind === "warning" ).length;
    const total = issues.length;
    const hasProblems = total > 0;

    useEffect( () => {
        setCopyStatus( "idle" );
    }, [ issues ] );

    useEffect( () => {
        if ( !open ) setCopyStatus( "idle" );
    }, [ open ] );

    const centerIssueRef = ( ref: IssueRef ) => {
        let x: number | undefined;
        let y: number | undefined;

        switch ( ref.kind ) {
            case "node": {
                const n = nodes.find( n => n.id === ref.id );
                if ( n ) { x = n.x; y = n.y; }
                break;
            }
            case "action": {
                const a = actions.find( a => a.id === ref.id );
                if ( a ) { x = a.x; y = a.y; }
                break;
            }
            case "condition": {
                const c = conditions.find( c => c.id === ref.id );
                if ( c ) { x = c.x; y = c.y; }
                break;
            }
            default: {
                // no-op
            }
        }

        if ( x == null || y == null ) return;

        useAppStore.setState( prev => {
            const viewBox = prev.viewBox ?? { x: 0, y: 0, w: 800, h: 600 };
            const panzoom = prev.panzoom ?? { x: 0, y: 0, zoom: 1 };

            const vw = viewBox.w;
            const vh = viewBox.h;
            const zoom = panzoom.zoom || 1;

            const panX = vw / 2 - zoom * x;
            const panY = vh / 2 - zoom * y;

            return {
                panzoom: {
                    ...panzoom,
                    x: panX,
                    y: panY,
                },
            };
        } );
    };

    const handleIssueClick = ( issueKey: string, ref?: IssueRef ) => {
        setActiveIssueKey( issueKey );

        if ( !ref ) {
            return;
        }

        switch ( ref.kind ) {
            case "node":
                selectSingleOrKeep( ref.id, false );
                break;
            case "action":
                selectSingleOrKeepAction( ref.id, false );
                break;
            case "condition":
                selectSingleOrKeepCondition( ref.id, false );
                break;
            default:
                // no-op
        }

        centerIssueRef( ref );
    };

    const copyTextWithSelectionFallback = ( text: string ): boolean => {
        const textarea = document.createElement( "textarea" );
        textarea.value = text;
        textarea.setAttribute( "readonly", "true" );
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild( textarea );
        textarea.select();

        try {
            return document.execCommand( "copy" );
        } finally {
            document.body.removeChild( textarea );
        }
    };

    const copyValidationIssues = async () => {
        if ( !hasProblems ) return;

        const report = formatValidationIssuesForClipboard( issues );
        if ( !navigator.clipboard?.writeText ) {
            console.warn( "[Validation] Clipboard API unavailable.", {
                fallback: "Trying textarea selection clipboard fallback.",
                impact: "Copy may still fail if browser permissions block clipboard writes.",
            } );
            setCopyStatus( copyTextWithSelectionFallback( report ) ? "copied" : "failed" );
            return;
        }

        try {
            await navigator.clipboard.writeText( report );
            setCopyStatus( "copied" );
        } catch ( error ) {
            console.warn( "[Validation] Clipboard API failed.", {
                cause: error,
                fallback: "Trying textarea selection clipboard fallback.",
                impact: "Copy may still fail if browser permissions block clipboard writes.",
            } );
            const copied = copyTextWithSelectionFallback( report );
            if ( !copied ) {
                console.error( "[Validation] Failed to copy issues to clipboard.", {
                    cause: error,
                    fallback: "Textarea selection clipboard fallback returned false.",
                    impact: "Validation issues were not copied.",
                } );
            }
            setCopyStatus( copied ? "copied" : "failed" );
        }
    };

    return (
        <div
            className="canvasValidation"
            style={ {
                position: "fixed",
                top: 8,
                right: 8,
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                zIndex: 1200,
            } }
        >
            <button
                ref={ triggerRef }
                type="button"
                onClick={ onToggle }
                aria-expanded={ open }
                aria-controls={ open ? "validation-panel" : undefined }
                title="Validation (Alt+V)"
                style={ {
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: hasProblems ? "#fff3cd" : "#f3f3f3",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                } }
            >
                <span
                    style={ {
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: errorCount
                            ? kindColor( "error" )
                            : warningCount
                                ? kindColor( "warning" )
                                : "#9e9e9e",
                    } }
                />
                <span>Validation</span>
                <span style={ { fontWeight: 600 } }>
                    { errorCount } errors, { warningCount } warnings
                </span>
            </button>

            { open && (
                <div
                    id="validation-panel"
                    ref={ panelRef }
                    role="region"
                    aria-label="Validation issues"
                    style={ {
                        position: "absolute",
                        top: "110%",
                        right: 0,
                        minWidth: 260,
                        maxWidth: 420,
                        maxHeight: 260,
                        overflowY: "auto",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        padding: 8,
                        background: "#ffffff",
                        fontSize: 12,
                        boxShadow: "0 4px 8px rgba(0,0,0,0.18)",
                        zIndex: 999,
                    } }
                >
                    <div
                        style={ {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 8,
                        } }
                    >
                        <div style={ { fontWeight: 600 } }>Validation issues</div>
                        <button
                            type="button"
                            disabled={ !hasProblems }
                            onClick={ () => void copyValidationIssues() }
                            title="Copy validation errors and warnings"
                            style={ {
                                padding: "3px 8px",
                                borderRadius: 4,
                                border: "1px solid #ccc",
                                background: hasProblems ? "#f8fafc" : "#f3f4f6",
                                color: hasProblems ? "#111827" : "#9ca3af",
                                cursor: hasProblems ? "pointer" : "not-allowed",
                                fontSize: 12,
                            } }
                        >
                            Copy list
                        </button>
                    </div>

                    { copyStatus === "copied" && (
                        <div
                            role="status"
                            style={ {
                                marginBottom: 8,
                                color: "#166534",
                            } }
                        >
                            Copied to clipboard.
                        </div>
                    ) }

                    { copyStatus === "failed" && (
                        <div
                            role="alert"
                            style={ {
                                marginBottom: 8,
                                color: "#b91c1c",
                            } }
                        >
                            Could not copy. Check browser clipboard permissions.
                        </div>
                    ) }

                    { !hasProblems && (
                        <div style={ { color: "#4caf50" } }>
                            No validation errors were found.
                        </div>
                    ) }

                    { hasProblems && (
                        <>
                            { ( [ "error", "warning" ] as const ).map( kind => {
                                const list = issues.filter( i => i.kind === kind );
                                if ( !list.length ) return null;

                                return (
                                    <div
                                        key={ kind }
                                        style={ {
                                            marginBottom: 8,
                                            paddingBottom: 6,
                                            borderBottom: "1px solid #eee",
                                        } }
                                    >
                                        <div
                                            style={ {
                                                marginTop: 2,
                                                marginBottom: 6,
                                                color: kindColor( kind ),
                                                fontWeight: 600,
                                            } }
                                        >
                                            { kindLabel( kind ) }{ " " }
                                            <span style={ { fontWeight: 400, color: "#555" } }>
                                                ({ list.length })
                                            </span>
                                        </div>

                                        { list.map( ( issue, idx ) => {
                                            const issueKey = `${kind}-${idx}`;
                                            const isHover = hoverIssueKey === issueKey;
                                            const isActive = activeIssueKey === issueKey;
                                            const isClickable = !!issue.ref;

                                            const bgColor = isActive
                                                ? "#dbeafe"
                                                : isHover
                                                    ? "#fffbeb"
                                                    : "transparent";

                                            const borderColor = isActive
                                                ? "#60a5fa"
                                                : isHover
                                                    ? "#9ca3af"
                                                    : "transparent";

                                            return (
                                                <button
                                                    key={ issueKey }
                                                    type="button"
                                                    disabled={ !isClickable }
                                                    onClick={ () => handleIssueClick( issueKey, issue.ref ) }
                                                    onFocus={ () => setHoverIssueKey( issueKey ) }
                                                    onBlur={ () =>
                                                        setHoverIssueKey( prev => ( prev === issueKey ? null : prev ) )
                                                    }
                                                    onMouseEnter={ () => setHoverIssueKey( issueKey ) }
                                                    onMouseLeave={ () =>
                                                        setHoverIssueKey( prev => ( prev === issueKey ? null : prev ) )
                                                    }
                                                    style={ {
                                                        width: "100%",
                                                        textAlign: "left",
                                                        padding: "3px 6px",
                                                        marginBottom: 2,
                                                        borderRadius: 4,
                                                        cursor: isClickable ? "pointer" : "default",
                                                        border: `1px dashed ${borderColor}`,
                                                        backgroundColor: bgColor,
                                                        transition:
                                                            "background-color 120ms ease, border-color 120ms ease",
                                                        opacity: isClickable ? 1 : 0.7,
                                                    } }
                                                >
                                                    <span>- [{ issue.code }] { issue.message }</span>
                                                    { issue.ref && (
                                                        <span style={ { marginLeft: 4, opacity: 0.7 } }>
                                                            ({ issueRefLabel( issue ) })
                                                        </span>
                                                    ) }
                                                </button>
                                            );
                                        } ) }
                                    </div>
                                );
                            } ) }
                        </>
                    ) }
                </div>
            ) }
        </div>
    );
};

export default WarningsPanel;
