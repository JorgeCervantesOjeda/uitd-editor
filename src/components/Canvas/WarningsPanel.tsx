import { useAppStore } from "../../state/store";
import type { NodeBox, Edge, ActionLabel, ConditionLabel } from "../../model/types";
import { getNodeSizeCached } from "../../layout/measurement";

/* ===================== helpers & types ===================== */

type Target =
    | { kind: "node"; id: number }
    | { kind: "action"; id: number }
    | { kind: "condition"; id: number }
    | { kind: "edge"; id: number };

type Severity = "error" | "warning";

type Diagnostic = {
    id: string;
    severity: Severity;
    message: string;
    details?: string;
    target?: Target;
};

function byId<T extends { id: number }>( arr: T[] ) {
    const m = new Map<number, T>();
    arr.forEach( ( x ) => m.set( x.id, x ) );
    return m;
}

function hasSameColors( a: NodeBox, b: NodeBox ) {
    return (
        ( a.colorFill ?? "" ) === ( b.colorFill ?? "" ) &&
        ( a.colorStroke ?? "" ) === ( b.colorStroke ?? "" ) &&
        ( a.colorText ?? "" ) === ( b.colorText ?? "" )
    );
}

// Normaliza para comparar títulos: trim, colapsa espacios y case-insensitive
function normTitle( s: string ): string {
    return ( s ?? "" ).trim().replace( /\s+/g, " " ).toLowerCase();
}

function focusTarget( t?: Target ) {
    if ( !t ) return;
    const s = useAppStore.getState();

    let tx = 0,
        ty = 0; // punto mundo a centrar

    if ( t.kind === "node" ) {
        const n = s.nodes.find( ( nn ) => nn.id === t.id );
        if ( !n ) return;
        const m = getNodeSizeCached( n );
        tx = n.x + m.w / 2;
        ty = n.y + m.h / 2;
    } else if ( t.kind === "action" ) {
        const a = s.actions.find( ( aa ) => aa.id === t.id );
        if ( !a ) return;
        tx = a.x;
        ty = a.y;
    } else if ( t.kind === "condition" ) {
        const c = s.conditions.find( ( cc ) => cc.id === t.id );
        if ( !c ) return;
        tx = c.x;
        ty = c.y;
    } else if ( t.kind === "edge" ) {
        // fallback: centrar el canvas
        const vb = s.viewBox;
        const zoom = s.panzoom.zoom;
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

/* ===================== diagnostics ===================== */

function buildDiagnostics(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    edges: Edge[]
): Diagnostic[] {
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

    edges.forEach( ( e ) => {
        if ( e.from.kind === "node" ) ensureArr( outFromNode, e.from.id ).push( e );
        if ( e.from.kind === "action" ) ensureArr( outFromAction, e.from.id ).push( e );
        if ( e.from.kind === "condition" ) ensureArr( outFromCond, e.from.id ).push( e );
    } );

    // 1) same displayId with different titles
    const byDisplay = new Map<string, Set<string>>();
    nodes.forEach( ( n ) => {
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
                details: `Titles: ${Array.from( titles ).join( " | " )}`,
            } );
        }
    }

    // 2) transitions pointing to non-existent target
    edges.forEach( ( e ) => {
        const okTo =
            ( e.to.kind === "node" && nodeMap.has( e.to.id ) ) ||
            ( e.to.kind === "action" && actionMap.has( e.to.id ) ) ||
            ( e.to.kind === "condition" && condMap.has( e.to.id ) );
        if ( !okTo ) {
            const fromTxt =
                e.from.kind === "node"
                    ? `from node#${e.from.id} “${nodeMap.get( e.from.id )?.title ?? "?"}”`
                    : e.from.kind === "action"
                        ? `from action#${e.from.id} “${actionMap.get( e.from.id )?.title ?? "?"}”`
                        : `from condition#${e.from.id} “${condMap.get( e.from.id )?.title ?? "?"}”`;
            list.push( {
                id: `dangling-to-${e.id}`,
                severity: "error",
                message: "Transition points to a non-existent target.",
                details: `edge #${e.id} (${fromTxt})`,
                target:
                    e.from.kind === "node"
                        ? { kind: "node", id: e.from.id }
                        : e.from.kind === "action"
                            ? { kind: "action", id: e.from.id }
                            : { kind: "condition", id: e.from.id },
            } );
        }
    } );

    // 3) two nodes share same color combination
    // 3) two nodes share the same color combination (but with DIFFERENT displayId)
    {
        // clave de colores
        const colorKey = ( n: NodeBox ) =>
            `${n.colorFill ?? ""}|${n.colorStroke ?? ""}|${n.colorText ?? ""}`;

        // agrupar por combinación de color
        const byColor = new Map<string, NodeBox[]>();
        nodes.forEach( n => {
            const k = colorKey( n );
            if ( !byColor.has( k ) ) byColor.set( k, [] );
            byColor.get( k )!.push( n );
        } );

        // Para cada combinación, mirar cuántos displayId distintos hay
        for ( const [ k, group ] of byColor.entries() ) {
            if ( group.length < 2 ) continue;

            // conjunto de displayId “normalizados” (fallback al id si falta)
            const dispSet = new Set(
                group.map( n => ( n.displayId ?? String( n.id ) ).trim() )
            );

            // Sólo advertimos si hay MÁS DE UN displayId usando exactamente el mismo esquema de colores
            if ( dispSet.size > 1 ) {
                // armamos detalles legibles
                const details = group
                    .map( n => {
                        const disp = ( n.displayId ?? String( n.id ) ).trim();
                        const title = ( n.title ?? "" ).trim();
                        return `n#${n.id} “${title}” (${disp})`;
                    } )
                    .join( " — " );

                // usa uno de los nodos como target (el primero)
                const t = group[ 0 ];
                list.push( {
                    id: `same-colors-xdisp-${k}`,
                    severity: "warning",
                    message: "Two or more nodes (with different displayId) share the same color scheme.",
                    details,
                    target: { kind: "node", id: t.id }
                } );
            }
        }
    }

    // 4) node has no outgoing transitions
    // 4) no outgoing transitions (grouped by displayId)
    {
        const byDisp = new Map<string, NodeBox[]>();
        nodes.forEach( n => {
            const disp = ( n.displayId ?? String( n.id ) ).trim();
            if ( !byDisp.has( disp ) ) byDisp.set( disp, [] );
            byDisp.get( disp )!.push( n );
        } );

        byDisp.forEach( ( group, disp ) => {
            const nodeIds = new Set( group.map( n => n.id ) );
            const groupActions = actions.filter( a => nodeIds.has( a.originNodeId ) );
            const actionIds = new Set( groupActions.map( a => a.id ) );
            const groupConds = conditions.filter( c => actionIds.has( c.originActionId ) );
            const condIds = new Set( groupConds.map( c => c.id ) );

            const hasOut =
                group.some( n => ( outFromNode.get( n.id )?.length ?? 0 ) > 0 ) ||
                Array.from( actionIds ).some( aid => ( outFromAction.get( aid )?.length ?? 0 ) > 0 ) ||
                Array.from( condIds ).some( cid => ( outFromCond.get( cid )?.length ?? 0 ) > 0 );

            if ( !hasOut ) {
                const titles = group.map( n => `n#${n.id} “${n.title}”` ).join( ", " );
                list.push( {
                    id: `no-out-${disp}`, // ← un ID por displayId evita duplicados
                    severity: "error",
                    message: "Node group (by displayId) has no outgoing transitions.",
                    details: `displayId “${disp}” — nodes: ${titles}`,
                    target: { kind: "node", id: group[ 0 ].id }
                } );
            }
        } );
    }

    // 5) action has neither conditions nor a target
    actions.forEach( ( a ) => {
        const hasCond = conditions.some( ( c ) => c.originActionId === a.id );
        const hasOut = ( outFromAction.get( a.id )?.length ?? 0 ) > 0;
        if ( !hasCond && !hasOut ) {
            list.push( {
                id: `action-no-cond-no-out-${a.id}`,
                severity: "error",
                message: "Action has neither conditions nor a target.",
                details: `action#${a.id} “${a.title}”`,
                target: { kind: "action", id: a.id },
            } );
        }
    } );

    // 5b) duplicate action titles per origin node (case/space-insensitive)
    {
        const byNode = new Map<number, ActionLabel[]>();
        actions.forEach( ( a ) => {
            if ( !byNode.has( a.originNodeId ) ) byNode.set( a.originNodeId, [] );
            byNode.get( a.originNodeId )!.push( a );
        } );

        for ( const [ nodeId, acts ] of byNode.entries() ) {
            const byTitle = new Map<string, ActionLabel[]>();
            acts.forEach( ( a ) => {
                const key = normTitle( a.title ?? "" );
                if ( !byTitle.has( key ) ) byTitle.set( key, [] );
                byTitle.get( key )!.push( a );
            } );

            for ( const [ titleKey, group ] of byTitle.entries() ) {
                if ( titleKey.length === 0 ) continue;
                if ( group.length > 1 ) {
                    const node = nodeMap.get( nodeId );
                    const nodeLabel = node
                        ? `n#${node.id} “${node.title}” (${node.displayId ?? node.id})`
                        : `node#${nodeId}`;
                    const actionIds = group.map( ( a ) => `a#${a.id}` ).join( ", " );
                    list.push( {
                        id: `dup-action-title-${nodeId}-${titleKey}`,
                        severity: "error",
                        message: `Duplicate action titles under the same node.`,
                        details: `Node: ${nodeLabel} — Title: “${group[ 0 ].title ?? ""}” — Actions: ${actionIds}`,
                        target: { kind: "node", id: nodeId },
                    } );
                }
            }
        }
    }

    // 6) condition has no target
    conditions.forEach( ( c ) => {
        const hasOut = ( outFromCond.get( c.id )?.length ?? 0 ) > 0;
        if ( !hasOut ) {
            list.push( {
                id: `cond-no-out-${c.id}`,
                severity: "error",
                message: "Condition has no target.",
                details: `condition#${c.id} “${c.title}”`,
                target: { kind: "condition", id: c.id },
            } );
        }
    } );

    // 6.bis) two conditions under the same action share the same title (case/space-insensitive)
    {
        const byAction = new Map<number, ConditionLabel[]>();
        conditions.forEach( ( c ) => {
            if ( !byAction.has( c.originActionId ) ) byAction.set( c.originActionId, [] );
            byAction.get( c.originActionId )!.push( c );
        } );

        for ( const [ actionId, conds ] of byAction.entries() ) {
            const grouped = new Map<string, ConditionLabel[]>();
            conds.forEach( ( c ) => {
                const key = normTitle( c.title ?? "" );
                if ( !grouped.has( key ) ) grouped.set( key, [] );
                grouped.get( key )!.push( c );
            } );

            for ( const [ k, group ] of grouped.entries() ) {
                if ( k.length === 0 ) continue;
                if ( group.length > 1 ) {
                    const a = actionMap.get( actionId );
                    const details = `action#${actionId} “${a?.title ?? "(action)"}” has ${group.length} conditions titled “${group[ 0 ]?.title ?? "(empty)"
                        }” (ids: ${group.map( ( x ) => x.id ).join( ", " )})`;
                    list.push( {
                        id: `dup-cond-title-a${actionId}-${k}`,
                        severity: "error",
                        message: "Action has duplicate condition titles.",
                        details,
                        target: { kind: "action", id: actionId },
                    } );
                }
            }
        }
    }

    // 7) displayId is empty or contains whitespace
    nodes.forEach( ( n ) => {
        const disp = n.displayId ?? String( n.id );
        if ( !disp.trim() || /\s/.test( disp ) ) {
            list.push( {
                id: `display-bad-${n.id}`,
                severity: "warning",
                message: "displayId is empty or contains whitespace.",
                details: `n#${n.id} “${n.title}” displayId="${disp}"`,
                target: { kind: "node", id: n.id },
            } );
        }
    } );

    return list;
}

/* ===================== component ===================== */

export function WarningsPanel( props: { open: boolean; onToggle: () => void } ) {
    const { open, onToggle } = props;

    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );
    const edges = useAppStore( ( s ) => s.edges );

    const diags = buildDiagnostics( nodes, actions, conditions, edges );

    const errorCount = diags.filter( ( d ) => d.severity === "error" ).length;
    const warnCount = diags.filter( ( d ) => d.severity === "warning" ).length;

    return (
        <div style={ { position: "relative", display: "inline-block" } }>
            <button
                onClick={ onToggle }
                title="Toggle diagnostics"
                style={ {
                    position: "relative",
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                } }
            >
                { open ? "Hide diagnostics" : "" } ({ errorCount }❗ { warnCount }⚠️)
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
                            background: errorCount > 0 ? "#ef4444" : "#f59e0b",
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

            { open && (
                <div
                    style={ {
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
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
                        zIndex: 10,
                    } }
                >
                    <div style={ { fontWeight: 600, color: "#0f172a" } }>
                        Diagnostics — { errorCount } errors, { warnCount } warnings
                    </div>

                    { diags.length === 0 && <div style={ { color: "#16a34a" } }>No issues.</div> }

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
