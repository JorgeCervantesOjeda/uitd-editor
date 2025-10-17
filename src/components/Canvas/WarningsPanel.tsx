import React from "react";
import { useAppStore } from "../../state/store";
import type { NodeBox, Edge, ActionLabel, ConditionLabel } from "../../model/types";
import { getNodeSizeCached } from "../../layout/measurement";

type Severity = "error" | "warning";
type Target =
    | { kind: "node"; id: number }
    | { kind: "action"; id: number }
    | { kind: "condition"; id: number }
    | { kind: "edge"; id: number };

type Diagnostic = {
    id: string;
    severity: Severity;
    message: string;
    details?: string;
    target?: Target; // ← NUEVO: elemento sobre el que enfocar
};

function byId<T extends { id: number }>( arr: T[] ) {
    const m = new Map<number, T>();
    arr.forEach( x => m.set( x.id, x ) );
    return m;
}

function hasSameColors( a: NodeBox, b: NodeBox ) {
    return ( a.colorFill ?? "" ) === ( b.colorFill ?? "" ) &&
        ( a.colorStroke ?? "" ) === ( b.colorStroke ?? "" ) &&
        ( a.colorText ?? "" ) === ( b.colorText ?? "" );
}

function nodeHasOutgoingTransitions(
    nodeId: number,
    edges: Edge[],
    actions: ActionLabel[],
    conditions: ConditionLabel[]
) {
    const actionIds = new Set( actions.filter( a => a.originNodeId === nodeId ).map( a => a.id ) );
    const condIds = new Set( conditions.filter( c => actionIds.has( c.originActionId ) ).map( c => c.id ) );
    return edges.some( e =>
        ( e.from.kind === "node" && e.from.id === nodeId ) ||
        ( e.from.kind === "action" && actionIds.has( e.from.id ) ) ||
        ( e.from.kind === "condition" && condIds.has( e.from.id ) )
    );
}

function focusTarget( t?: Target ) {
    if ( !t ) return;
    const s = useAppStore.getState();

    let tx = 0, ty = 0; // punto mundo a centrar

    if ( t.kind === "node" ) {
        const n = s.nodes.find( nn => nn.id === t.id );
        if ( !n ) return;
        const m = getNodeSizeCached( n );
        tx = n.x + m.w / 2;
        ty = n.y + m.h / 2;
    } else if ( t.kind === "action" ) {
        const a = s.actions.find( aa => aa.id === t.id );
        if ( !a ) return;
        tx = a.x; ty = a.y;
    } else if ( t.kind === "condition" ) {
        const c = s.conditions.find( cc => cc.id === t.id );
        if ( !c ) return;
        tx = c.x; ty = c.y;
    } else if ( t.kind === "edge" ) {
        // fallback: centra el canvas (o podrías calcular el medio del edge si te interesa)
        const vb = s.viewBox; const zoom = s.panzoom.zoom;
        const desiredPanX = vb.w / 2 - ( vb.w / 2 ) * zoom;
        const desiredPanY = vb.h / 2 - ( vb.h / 2 ) * zoom;
        const dx0 = desiredPanX - s.panzoom.x;
        const dy0 = desiredPanY - s.panzoom.y;
        s.setPan( dx0, dy0 );
        return;
    }

    const zoom = s.panzoom.zoom;
    const vb = s.viewBox;
    const desiredPanX = vb.w / 2 - tx * zoom;
    const desiredPanY = vb.h / 2 - ty * zoom;
    const dx = desiredPanX - s.panzoom.x;
    const dy = desiredPanY - s.panzoom.y;
    s.setPan( dx, dy );
}

function buildDiagnostics(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    edges: Edge[]
) {
    type Severity = "error" | "warning";
    type Target =
        | { kind: "node"; id: number }
        | { kind: "action"; id: number }
        | { kind: "condition"; id: number }
        | { kind: "edge"; id: number };

    type Diagnostic = {
        id: string;
        severity: Severity;
        message: string;
        details?: string;
        target?: Target;
    };

    const list: Diagnostic[] = [];

    if ( nodes.length === 0 ) {
        list.push( { id: "empty-graph", severity: "error", message: "Diagram is empty." } );
        return list;
    }

    const nodeMap = byId( nodes );
    const actionMap = byId( actions );
    const condMap = byId( conditions );

    // Índices de aristas
    const outFromNode = new Map<number, Edge[]>();
    const outFromAction = new Map<number, Edge[]>();
    const outFromCond = new Map<number, Edge[]>();

    const ensureArr = <K, V>( map: Map<K, V[]>, key: K ) =>
        map.get( key ) ?? ( map.set( key, [] ), map.get( key )! );

    edges.forEach( e => {
        if ( e.from.kind === "node" ) ensureArr( outFromNode, e.from.id ).push( e );
        if ( e.from.kind === "action" ) ensureArr( outFromAction, e.from.id ).push( e );
        if ( e.from.kind === "condition" ) ensureArr( outFromCond, e.from.id ).push( e );
    } );

    // 1) same displayId with different titles
    const byDisplay = new Map<string, Set<string>>();
    nodes.forEach( n => {
        const key = ( n.displayId ?? String( n.id ) ).trim();
        const tit = ( n.title ?? "" ).trim();
        if ( !byDisplay.has( key ) ) byDisplay.set( key, new Set<string>() );
        byDisplay.get( key )!.add( tit );
    } );
    for ( const [ disp, titles ] of byDisplay.entries() ) {
        if ( titles.size > 1 ) {
            list.push( {
                id: `dup-display-${disp}`,
                severity: "error",
                message: `Same displayId (“${disp}”) with different titles.`,
                details: `Titles: ${Array.from( titles ).join( " | " )}`
            } );
        }
    }

    // 2) transitions pointing to non-existent target
    edges.forEach( e => {
        const okTo =
            ( e.to.kind === "node" && nodeMap.has( e.to.id ) ) ||
            ( e.to.kind === "action" && actionMap.has( e.to.id ) ) ||
            ( e.to.kind === "condition" && condMap.has( e.to.id ) );
        if ( !okTo ) {
            list.push( {
                id: `dangling-to-${e.id}`,
                severity: "error",
                message: "Transition points to a non-existent target.",
                details: ( () => {
                    const fromTxt =
                        e.from.kind === "node" ? `from node#${e.from.id} “${nodeMap.get( e.from.id )?.title ?? "?"}”` :
                            e.from.kind === "action" ? `from action#${e.from.id} “${actionMap.get( e.from.id )?.title ?? "?"}”` :
                                `from condition#${e.from.id} “${condMap.get( e.from.id )?.title ?? "?"}”`;
                    return `edge #${e.id} (${fromTxt})`;
                } )(),
                target:
                    e.from.kind === "node" ? { kind: "node", id: e.from.id } :
                        e.from.kind === "action" ? { kind: "action", id: e.from.id } :
                            { kind: "condition", id: e.from.id }
            } );
        }
    } );

    // 3) two nodes share same color combination
    for ( let i = 0; i < nodes.length; i++ ) {
        for ( let j = i + 1; j < nodes.length; j++ ) {
            if ( hasSameColors( nodes[ i ], nodes[ j ] ) ) {
                list.push( {
                    id: `same-colors-${nodes[ i ].id}-${nodes[ j ].id}`,
                    severity: "warning",
                    message: "Two nodes share the same color combination.",
                    details: `n#${nodes[ i ].id} “${nodes[ i ].title}” and n#${nodes[ j ].id} “${nodes[ j ].title}”`,
                    target: { kind: "node", id: nodes[ i ].id }
                } );
            }
        }
    }

    // 4) node has no outgoing transitions
    nodes.forEach( n => {
        const actionIds = new Set( actions.filter( a => a.originNodeId === n.id ).map( a => a.id ) );
        const condIds = new Set( conditions.filter( c => actionIds.has( c.originActionId ) ).map( c => c.id ) );
        const hasOut =
            ( outFromNode.get( n.id )?.length ?? 0 ) > 0 ||
            Array.from( actionIds ).some( aid => ( outFromAction.get( aid )?.length ?? 0 ) > 0 ) ||
            Array.from( condIds ).some( cid => ( outFromCond.get( cid )?.length ?? 0 ) > 0 );
        if ( !hasOut ) {
            list.push( {
                id: `no-out-${n.id}`,
                severity: "error",
                message: "Node has no outgoing transitions.",
                details: `n#${n.id} “${n.title}” (${n.displayId ?? n.id})`,
                target: { kind: "node", id: n.id }
            } );
        }
    } );

    // 5) action has neither conditions nor a target
    actions.forEach( a => {
        const hasCond = conditions.some( c => c.originActionId === a.id );
        const hasOut = ( outFromAction.get( a.id )?.length ?? 0 ) > 0;
        if ( !hasCond && !hasOut ) {
            list.push( {
                id: `action-no-cond-no-out-${a.id}`,
                severity: "error",
                message: "Action has neither conditions nor a target.",
                details: `action#${a.id} “${a.title}”`,
                target: { kind: "action", id: a.id }
            } );
        }
    } );

    // 6) condition has no target
    conditions.forEach( c => {
        const hasOut = ( outFromCond.get( c.id )?.length ?? 0 ) > 0;
        if ( !hasOut ) {
            list.push( {
                id: `cond-no-out-${c.id}`,
                severity: "error",
                message: "Condition has no target.",
                details: `condition#${c.id} “${c.title}”`,
                target: { kind: "condition", id: c.id }
            } );
        }
    } );

    // 7) displayId is empty or contains whitespace
    nodes.forEach( n => {
        const disp = ( n.displayId ?? String( n.id ) );
        if ( !disp.trim() || /\s/.test( disp ) ) {
            list.push( {
                id: `display-bad-${n.id}`,
                severity: "warning",
                message: "displayId is empty or contains whitespace.",
                details: `n#${n.id} “${n.title}” displayId="${disp}"`,
                target: { kind: "node", id: n.id }
            } );
        }
    } );

    return list;
}


export function WarningsPanel( props: {
    open: boolean;
    onToggle: () => void;
} ) {
    const { open, onToggle } = props;

    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );

    const diags = buildDiagnostics( nodes, actions, conditions, edges );

    const errorCount = diags.filter( d => d.severity === "error" ).length;
    const warnCount = diags.filter( d => d.severity === "warning" ).length;

    return (
        <div
            style={ {
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 60,
                display: "flex",
                gap: 8,
                alignItems: "start",
                pointerEvents: "none" // ← para que no interfiera con el canvas
            }
            }
        >
            <button
                onClick={ onToggle }
                title="Toggle diagnostics"
                style={ {
                    position: "relative", // ← necesario para badge
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                    pointerEvents: "auto", // ← para que el botón sí funcione
                } }
            >
                { open ? "Hide diagnostics" : "Show diagnostics" } ({ errorCount }❗ { warnCount }⚠️)
                {/* BADGE */ }
                { ( errorCount > 0 || warnCount > 0 ) && (
                    <span
                        style={ {
                            position: "absolute",
                            top: -6,
                            right: -6,
                            minWidth: 18,
                            height: 18,
                            padding: "0 6px",
                            borderRadius: 999,
                            background: errorCount > 0 ? "#ef4444" : "#f59e0b", // rojo si hay errores, ámbar si solo warnings
                            color: "white",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 6px rgba(2,6,23,.3)"
                        } }
                    >
                        { errorCount > 0 ? errorCount : warnCount }
                    </span>
                ) }
            </button>

            {
                open && (
                    <div
                        style={
                            {
                                width: 360,
                                maxHeight: 360,
                                overflow: "auto",
                                border: "1px solid #cbd5e1",
                                borderRadius: 10,
                                background: "#ffffff",
                                boxShadow: "0 8px 24px rgba(2,6,23,.18)",
                                padding: 12,
                                display: "grid",
                                gap: 8,
                                pointerEvents: "auto" // ← para que el panel sí funcione
                            }
                        }
                    >
                        <div style={ { fontWeight: 600, color: "#0f172a" } }>
                            Diagnostics — { errorCount } errors, { warnCount } warnings
                        </div>

                        {
                            diags.length === 0 && (
                                <div style={ { color: "#16a34a" } }> No issues.</div>
                            )
                        }

                        { diags.map( d => (
                            <div
                                key={ d.id }
                                onClick={ () => focusTarget( d.target ) }
                                style={ {
                                    border: "1px solid",
                                    borderColor: d.severity === "error" ? "#ef4444" : "#f59e0b",
                                    background: d.severity === "error" ? "#fef2f2" : "#fffbeb",
                                    color: d.severity === "error" ? "#991b1b" : "#92400e",
                                    padding: 8,
                                    borderRadius: 8,
                                    cursor: d.target ? "pointer" : "default"
                                } }
                                title={ d.target ? "Click to center on element" : undefined }
                            >
                                <div style={ { fontWeight: 600, textDecoration: d.target ? "underline" : "none" } }>
                                    { d.severity === "error" ? "❗ Error: " : "⚠️ Warning: " }
                                    { d.message }
                                </div>
                                { d.details && (
                                    <div style={ { fontSize: 12, opacity: 0.9, marginTop: 4 } }>
                                        { d.details }
                                    </div>
                                ) }
                            </div>
                        ) ) }
                    </div>
                ) }
        </div>
    );
}
