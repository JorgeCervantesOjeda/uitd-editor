// src/io/uitdl/import.ts
import type {
    ActionId, ConditionId, NodeId,
    ActionLabel, ConditionLabel, NodeBox, Edge, EdgeEndpoint
} from "../../model/types";

type UIRef = { id: number; children: UIRef[] };
type Transition = {
    from: number;
    to: number;
    actionText: string;
    conditionText?: string;
    width?: number;
};

type UITDLParsed = {
    title: string;
    uis: Map<number, { id: number; name: string; actions: string[] }>;
    drawRoots: UIRef[];     // bosque (varias raíces)
    transitions: Transition[];
};

const tok = ( re: RegExp, s: string, i: number ) => {
    re.lastIndex = i;
    const m = re.exec( s );
    return m && m.index === i ? m : null;
};

function parseQuoted( s: string, i: number ) {
    const m = tok( /"([^"]*)"/y, s, i );
    if ( !m ) throw syntax( "quoted string", s, i );
    return { text: m[ 1 ], next: m.index + m[ 0 ].length };
}
function parseNumber( s: string, i: number ) {
    const m = tok( /[0-9]+/y, s, i );
    if ( !m ) throw syntax( "number", s, i );
    return { num: parseInt( m[ 0 ], 10 ), next: m.index + m[ 0 ].length };
}
function skipWS( s: string, i: number ) {
    const m = tok( /\s*/y, s, i );
    return m ? m.index + m[ 0 ].length : i;
}
function expect( sym: string, s: string, i: number ) {
    const m = tok( new RegExp( sym.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" ), "y" ), s, i );
    if ( !m ) throw syntax( `'${sym}'`, s, i );
    return m.index + m[ 0 ].length;
}
function syntax( exp: string, s: string, i: number ): Error {
    const near = s.slice( Math.max( 0, i - 30 ), i + 30 ).replace( /\n/g, "\\n" );
    return new Error( `UITDL parse error: expected ${exp} near “…${near}…”, at ${i}` );
}

// UIREF := UIID [ "(" UIREFLIST ")" ]
function parseUIRef( s: string, i0: number ): { ref: UIRef; next: number } {
    let i = skipWS( s, i0 );
    const { num: id, next: i1 } = parseNumber( s, i );
    i = skipWS( s, i1 );
    const children: UIRef[] = [];
    if ( s[ i ] === "(" ) {
        i = expect( "(", s, i );
        i = skipWS( s, i );
        while ( true ) {
            const got = parseUIRef( s, i );
            children.push( got.ref );
            i = skipWS( s, got.next );
            if ( s[ i ] === "," ) { i++; i = skipWS( s, i ); continue; }
            i = expect( ")", s, i );
            break;
        }
        i = skipWS( s, i );
    }
    return { ref: { id, children }, next: i };
}

// UIREFLIST := UIREF ("," UIREF)*
function parseUIRefList( s: string, i0: number ): { list: UIRef[]; next: number } {
    let i = skipWS( s, i0 );
    const out: UIRef[] = [];
    while ( true ) {
        const got = parseUIRef( s, i );
        out.push( got.ref );
        i = skipWS( s, got.next );
        if ( s[ i ] === "," ) { i++; i = skipWS( s, i ); continue; }
        break;
    }
    return { list: out, next: i };
}

function parseUITDL( source: string ): UITDLParsed {
    let i = skipWS( source, 0 );

    // UITD "Title" { … }
    i = expect( "UITD", source, i ); i = skipWS( source, i );
    const q = parseQuoted( source, i ); const title = q.text; i = skipWS( source, q.next );
    i = expect( "{", source, i ); i = skipWS( source, i );

    const uis = new Map<number, { id: number; name: string; actions: string[] }>();
    const drawRoots: UIRef[] = [];
    const transitions: Transition[] = [];

    // Helpers
    const parseUI = () => {
        // UI <num> "name" actions { <action+> }
        i = expect( "UI", source, i ); i = skipWS( source, i );
        const { num: id, next: i1 } = parseNumber( source, i ); i = skipWS( source, i1 );
        const q1 = parseQuoted( source, i ); const name = q1.text; i = skipWS( source, q1.next );
        i = expect( "actions", source, i ); i = skipWS( source, i );
        i = expect( "{", source, i ); i = skipWS( source, i );
        const acts: string[] = [];
        while ( true ) {
            // VERB QUOTED ";"
            const mVerb = tok( /(clicks|submits|selects|types|toggles|uploads|downloads|saves|deletes|waits)\b/y, source, i );
            if ( !mVerb ) break;
            i = mVerb.index + mVerb[ 0 ].length; i = skipWS( source, i );
            const qx = parseQuoted( source, i ); acts.push( qx.text );
            i = skipWS( source, qx.next );
            i = expect( ";", source, i );
            i = skipWS( source, i );
        }
        i = expect( "}", source, i ); i = skipWS( source, i );
        uis.set( id, { id, name, actions: acts } );
    };

    const parseDRAW = () => {
        // DRAW { UIREFLIST };
        i = expect( "DRAW", source, i ); i = skipWS( source, i );
        i = expect( "{", source, i ); i = skipWS( source, i );
        const { list, next } = parseUIRefList( source, i );
        i = skipWS( source, next );
        i = expect( "}", source, i ); i = skipWS( source, i );
        i = expect( ";", source, i ); i = skipWS( source, i );
        drawRoots.push( ...list );
    };

    const parseTRANSITION = () => {
        // TRANSITION from UIREF to UIREF if user clicks "..." [AND "cond"] [width N] ;
        i = expect( "TRANSITION", source, i ); i = skipWS( source, i );
        i = expect( "from", source, i ); i = skipWS( source, i );
        const from = parseUIRef( source, i ); i = skipWS( source, from.next );
        i = expect( "to", source, i ); i = skipWS( source, i );
        const to = parseUIRef( source, i ); i = skipWS( source, i );
        i = expect( "if", source, i ); i = skipWS( source, i );
        i = expect( "user", source, i ); i = skipWS( source, i );
        const verb = tok( /clicks\b/y, source, i );
        if ( !verb ) throw syntax( "'clicks'", source, i );
        i = verb.index + verb[ 0 ].length; i = skipWS( source, i );
        const qa = parseQuoted( source, i ); const actionText = qa.text; i = skipWS( source, qa.next );

        let conditionText: string | undefined;
        // Optional AND "cond"
        const maybeAND = tok( /AND\b/y, source, i );
        if ( maybeAND ) {
            i = maybeAND.index + maybeAND[ 0 ].length; i = skipWS( source, i );
            const qc = parseQuoted( source, i );
            conditionText = qc.text;
            i = skipWS( source, qc.next );
        }

        // Optional width N
        let width: number | undefined;
        const maybeWidth = tok( /width\b/y, source, i );
        if ( maybeWidth ) {
            i = maybeWidth.index + maybeWidth[ 0 ].length; i = skipWS( source, i );
            const wn = parseNumber( source, i );
            width = wn.num;
            i = skipWS( source, wn.next );
        }

        i = expect( ";", source, i ); i = skipWS( source, i );

        transitions.push( {
            from: from.ref.id,
            to: to.ref.id,
            actionText,
            conditionText,
            width
        } );
    };

    // cuerpo { … }
    while ( source[ i ] !== "}" ) {
        const mUI = tok( /UI\b/y, source, i );
        if ( mUI ) { parseUI(); continue; }
        const mFR = tok( /FRAGMENT\b/y, source, i );
        if ( mFR ) {
            i = mFR.index + mFR[ 0 ].length; i = skipWS( source, i );
            // FRAGMENT "name" { DRAW+ TRANSITION+ }
            const qf = parseQuoted( source, i ); /* const fragName = qf.text; */ i = skipWS( source, qf.next );
            i = expect( "{", source, i ); i = skipWS( source, i );
            // al menos un DRAW
            parseDRAW();
            // luego 0+ DRAW y 1+ TRANSITION en cualquier orden
            while ( true ) {
                const mD = tok( /DRAW\b/y, source, i );
                const mT = tok( /TRANSITION\b/y, source, i );
                if ( mD ) { parseDRAW(); continue; }
                if ( mT ) { parseTRANSITION(); continue; }
                break;
            }
            i = expect( "}", source, i ); i = skipWS( source, i );
            continue;
        }
        // espacio/comentarios simples
        const before = i;
        i = skipWS( source, i );
        if ( i === before ) throw syntax( "UI | FRAGMENT | '}'", source, i );
    }

    i = expect( "}", source, i );
    i = skipWS( source, i );
    return { title, uis, drawRoots, transitions };
}

/** Aplana UIRefs y construye parentId por jerarquía del DRAW */
function flattenTree( roots: UIRef[] ): Map<number, number | null> {
    const parent = new Map<number, number | null>();
    const dfs = ( node: UIRef, p: number | null ) => {
        parent.set( node.id, p );
        for ( const ch of node.children ) dfs( ch, node.id );
    };
    for ( const r of roots ) dfs( r, null );
    return parent;
}

/** Construye el “proyecto” para tu editor a partir del texto UITDL */
export function importUitdToProject( source: string ): {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    nextId: number;
    nextActionId: number;
    nextEdgeId: number;
} {
    const ast = parseUITDL( source );

    // parentId por DRAW
    const parentById = flattenTree( ast.drawRoots );

    // NODES
    const nodes: NodeBox[] = [];
    for ( const [ id, ui ] of ast.uis.entries() ) {
        // Sólo crear si aparece en el DRAW (si no, omítelo o cámbialo si quieres incluir todos)
        if ( !parentById.has( id ) ) continue;
        nodes.push( {
            id: id as NodeId,
            x: 0,
            y: 0,
            title: ui.name,
            parentId: parentById.get( id ) as number | null | undefined,
        } );
    }

    // Index para ubicar nodos por id
    const byId = new Map<number, NodeBox>( nodes.map( n => [ n.id, n ] ) );

    // ACTIONS / CONDITIONS / EDGES
    const actions: ActionLabel[] = [];
    const conditions: ConditionLabel[] = [];
    const edges: Edge[] = [];

    let nextActionId = 1 as ActionId;
    let nextEdgeId = 1;

    // Helper para crear aristas
    const E = ( from: EdgeEndpoint, to: EdgeEndpoint ): Edge => ( {
        id: nextEdgeId++,
        from, to,
        style: "solid",
    } );

    for ( const tr of ast.transitions ) {
        // saltar transiciones cuyo from/to no estén dibujados
        if ( !byId.has( tr.from ) || !byId.has( tr.to ) ) continue;

        // Acción pegada al origen
        const actId = nextActionId++ as ActionId;
        const a: ActionLabel = {
            id: actId,
            originNodeId: tr.from as NodeId,
            x: ( byId.get( tr.from )!.x ) + 100, // posición inicial razonable
            y: ( byId.get( tr.from )!.y ),
            title: tr.actionText,
        };
        actions.push( a );

        // node(from) -> action
        edges.push( E( { kind: "node", id: tr.from as NodeId }, { kind: "action", id: a.id } ) );

        let lastHop: EdgeEndpoint = { kind: "action", id: a.id };

        if ( tr.conditionText && tr.conditionText.trim().length > 0 ) {
            // Condición opcional
            const condId = conditions.length + 1 as ConditionId;
            const c: ConditionLabel = {
                id: condId,
                originActionId: a.id,
                x: a.x + 80,
                y: a.y + 40,
                title: tr.conditionText,
            };
            conditions.push( c );

            // action -> condition (arista especial que tu renderer pinta con "?")
            edges.push( E( { kind: "action", id: a.id }, { kind: "condition", id: c.id } ) );
            lastHop = { kind: "condition", id: c.id };
        }

        // … -> node(to)
        edges.push( E( lastHop, { kind: "node", id: tr.to as NodeId } ) );

        // (Opcional) Si quisieras mapear width numérico → estilos, hazlo aquí con tr.width
    }

    const nextId = ( nodes.length ? ( Math.max( ...nodes.map( n => n.id ) ) + 1 ) : 1 ) as NodeId;
    return {
        nodes,
        actions,
        conditions,
        edges,
        nextId,
        nextActionId,
        nextEdgeId
    };
}
