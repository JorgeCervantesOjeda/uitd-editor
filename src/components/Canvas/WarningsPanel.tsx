// src/components/Canvas/WarningsPanel.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useAppStore } from "../../state/store";
import {
    validateDiagram,
    type DiagramIssue,
    type IssueRef,
} from "../../validation/diagramValidation";

type Props = {
    open: boolean;
    onToggle: () => void;
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
            return `Acción ${ref.id}`;
        case "condition":
            return `Condición ${ref.id}`;
        default:
            return "";
    }
};

export const WarningsPanel: React.FC<Props> = ( { open, onToggle } ) => {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );

    const selectSingleOrKeep = useAppStore( s => s.selectSingleOrKeep );
    const selectSingleOrKeepAction = useAppStore(
        s => s.selectSingleOrKeepAction,
    );
    const selectSingleOrKeepCondition = useAppStore(
        s => s.selectSingleOrKeepCondition,
    );

    const [ hoverIssueKey, setHoverIssueKey ] = useState<string | null>( null );
    const [ activeIssueKey, setActiveIssueKey ] = useState<string | null>( null );

    const issues: DiagramIssue[] = useMemo(
        () =>
            validateDiagram( {
                nodes,
                actions,
                conditions,
                edges,
            } ),
        [ nodes, actions, conditions, edges ],
    );

    // DEBUG: ver qué devuelve validateDiagram
    useEffect( () => {
        console.log( "[WarningsPanel] issues recomputed (count=", issues.length, ")" );
        for ( const issue of issues ) {
            console.log( "[WarningsPanel] issue:", {
                kind: issue.kind,
                message: issue.message,
                fragmentId: issue.fragmentId,
                ref: issue.ref,
            } );
        }
    }, [ issues ] );

    const errorCount = issues.filter( i => i.kind === "error" ).length;
    const warningCount = issues.filter( i => i.kind === "warning" ).length;

    const issuesByFragment = useMemo( () => {
        const byFrag = new Map<string, DiagramIssue[]>();
        for ( const issue of issues ) {
            const fragId = issue.fragmentId ?? "F?";
            if ( !byFrag.has( fragId ) ) byFrag.set( fragId, [] );
            byFrag.get( fragId )!.push( issue );
        }
        return Array.from( byFrag.entries() ).sort( ( a, b ) =>
            a[ 0 ].localeCompare( b[ 0 ] ),
        );
    }, [ issues ] );

    const centerIssueRef = ( ref: IssueRef ) => {
        console.log( "[WarningsPanel] centerIssueRef called with ref:", ref );

        let x: number | undefined;
        let y: number | undefined;

        switch ( ref.kind ) {
            case "node": {
                const n = nodes.find( n => n.id === ( ref as any ).id );
                console.log( "[WarningsPanel] node lookup:", { ref, found: n } );
                if ( n ) { x = n.x; y = n.y; }
                break;
            }
            case "action": {
                const a = actions.find( a => a.id === ( ref as any ).id );
                console.log( "[WarningsPanel] action lookup:", { ref, found: a } );
                if ( a ) { x = a.x; y = a.y; }
                break;
            }
            case "condition": {
                const c = conditions.find( c => c.id === ( ref as any ).id );
                console.log( "[WarningsPanel] condition lookup:", { ref, found: c } );
                if ( c ) { x = c.x; y = c.y; }
                break;
            }
            default: {
                // Si validateDiagram usa otro string en kind, lo veremos aquí
                console.warn( "[WarningsPanel] centerIssueRef: kind desconocido", ref );
            }
        }

        console.log( "[WarningsPanel] centerIssueRef coords:", { x, y } );

        if ( x == null || y == null ) return;

        useAppStore.setState( prev => {
            const viewBox = prev.viewBox ?? { x: 0, y: 0, w: 800, h: 600 };
            const panzoom = prev.panzoom ?? { x: 0, y: 0, zoom: 1 };

            const vw = viewBox.w;
            const vh = viewBox.h;
            const zoom = panzoom.zoom || 1;

            const panX = vw / 2 - zoom * x;
            const panY = vh / 2 - zoom * y;

            const next = {
                panzoom: {
                    ...panzoom,
                    x: panX,
                    y: panY,
                },
            };

            console.log( "[WarningsPanel] centerIssueRef new panzoom:", next.panzoom );
            return next;
        } );
    };

    const handleIssueClick = ( issueKey: string, ref?: IssueRef ) => {
        console.log( "[WarningsPanel] handleIssueClick", { issueKey, ref } );

        // marcar visualmente cuál fue el último issue clicado
        setActiveIssueKey( issueKey );

        if ( !ref ) {
            console.warn( "[WarningsPanel] handleIssueClick: issue sin ref, no se puede centrar" );
            return;
        }

        switch ( ref.kind ) {
            case "node":
                console.log( "[WarningsPanel] selecting node", ref.id );
                selectSingleOrKeep( ( ref as any ).id, false );
                break;
            case "action":
                console.log( "[WarningsPanel] selecting action", ref.id );
                selectSingleOrKeepAction( ( ref as any ).id, false );
                break;
            case "condition":
                console.log( "[WarningsPanel] selecting condition", ref.id );
                selectSingleOrKeepCondition( ( ref as any ).id, false );
                break;
            default:
                console.warn( "[WarningsPanel] handleIssueClick: ref.kind desconocido", ref );
        }

        centerIssueRef( ref );
    };

    const total = issues.length;
    const hasProblems = total > 0;

    return (
        <div style={ { position: "relative", display: "flex", alignItems: "stretch", gap: 8 } }>
            <button
                type="button"
                onClick={ onToggle }
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
                    { !hasProblems && (
                        <div style={ { color: "#4caf50" } }>
                            No validation errors were found.
                        </div>
                    ) }

                    { hasProblems &&
                        issuesByFragment.map( ( [ fragId, fragIssues ] ) => {
                            const fragErrors = fragIssues.filter(
                                i => i.kind === "error",
                            );
                            const fragWarnings = fragIssues.filter(
                                i => i.kind === "warning",
                            );

                            return (
                                <div
                                    key={ fragId }
                                    style={ {
                                        marginBottom: 8,
                                        paddingBottom: 6,
                                        borderBottom: "1px solid #eee",
                                    } }
                                >
                                    <div
                                        style={ {
                                            fontWeight: 600,
                                            marginBottom: 4,
                                        } }
                                    >
                                        Fragment { fragId }{ " " }
                                        <span style={ { fontWeight: 400 } }>
                                            (
                                            { fragErrors.length } errors,{ " " }
                                            { fragWarnings.length } warnings)
                                        </span>
                                    </div>

                                    { [ "error", "warning" ].map( kind => {
                                        const list = fragIssues.filter( i => i.kind === kind );
                                        if ( !list.length ) return null;

                                        return (
                                            <div key={ kind }>
                                                <div
                                                    style={ {
                                                        marginTop: 2,
                                                        marginBottom: 2,
                                                        color: kindColor( kind as any ),
                                                        fontWeight: 600,
                                                    } }
                                                >
                                                    { kindLabel( kind as any ) }
                                                </div>

                                                { list.map( ( issue, idx ) => {
                                                    const issueKey = `${fragId}-${kind}-${idx}`;
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
                                                        <div
                                                            key={ idx }
                                                            onClick={ () => handleIssueClick( issueKey, issue.ref ) }
                                                            onMouseEnter={ () => setHoverIssueKey( issueKey ) }
                                                            onMouseLeave={ () =>
                                                                setHoverIssueKey( prev => ( prev === issueKey ? null : prev ) )
                                                            }
                                                            style={ {
                                                                padding: "3px 6px",
                                                                marginBottom: 2,
                                                                borderRadius: 4,
                                                                cursor: isClickable ? "pointer" : "default",
                                                                border: `1px dashed ${borderColor}`,
                                                                backgroundColor: bgColor,
                                                                transition:
                                                                    "background-color 120ms ease, border-color 120ms ease",
                                                            } }
                                                        >
                                                            <span>• { issue.message }</span>
                                                            { issue.ref && (
                                                                <span
                                                                    style={ {
                                                                        marginLeft: 4,
                                                                        opacity: 0.7,
                                                                    } }
                                                                >
                                                                    ({ refLabel( issue.ref ) })
                                                                </span>
                                                            ) }
                                                        </div>
                                                    );
                                                } ) }
                                            </div>
                                        );
                                    } ) }
                                </div>
                            );
                        } ) }
                </div>
            ) }
        </div>
    );
};

export default WarningsPanel;
