import { useMemo } from "react";
import { useAppStore } from "../../state/store";
import { getActionSizeCached, getConditionSizeCached, getNodeSizeCached } from "../../layout/measurement";
import type { EdgeEndpoint } from "../../model/types";

type FragmentBounds = {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
};

class UnionFind {
    private parent = new Map<string, string>();
    private rank = new Map<string, number>();

    add( x: string ) {
        if ( this.parent.has( x ) ) return;
        this.parent.set( x, x );
        this.rank.set( x, 0 );
    }

    find( x: string ): string {
        if ( !this.parent.has( x ) ) this.add( x );
        const p = this.parent.get( x )!;
        if ( p === x ) return x;
        const root = this.find( p );
        this.parent.set( x, root );
        return root;
    }

    union( a: string, b: string ) {
        this.add( a );
        this.add( b );

        let ra = this.find( a );
        let rb = this.find( b );
        if ( ra === rb ) return;

        const rka = this.rank.get( ra ) ?? 0;
        const rkb = this.rank.get( rb ) ?? 0;
        if ( rka < rkb ) [ ra, rb ] = [ rb, ra ];

        this.parent.set( rb, ra );
        if ( rka === rkb ) this.rank.set( ra, rka + 1 );
    }

    groups(): Map<string, string[]> {
        const out = new Map<string, string[]>();
        for ( const x of this.parent.keys() ) {
            const root = this.find( x );
            if ( !out.has( root ) ) out.set( root, [] );
            out.get( root )!.push( x );
        }
        return out;
    }
}

const keyOf = ( ep: EdgeEndpoint ): string => `${ep.kind}:${ep.id}`;

function expand(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    x: number,
    y: number,
    w: number,
    h: number
) {
    bounds.minX = Math.min( bounds.minX, x - w / 2 );
    bounds.minY = Math.min( bounds.minY, y - h / 2 );
    bounds.maxX = Math.max( bounds.maxX, x + w / 2 );
    bounds.maxY = Math.max( bounds.maxY, y + h / 2 );
}

export function FragmentFramesLayer() {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const canvasDark = useAppStore( s => s.canvasDark );

    const fragments = useMemo<FragmentBounds[]>( () => {
        const uf = new UnionFind();

        for ( const n of nodes ) uf.add( `node:${n.id}` );
        for ( const a of actions ) uf.add( `action:${a.id}` );
        for ( const c of conditions ) uf.add( `condition:${c.id}` );

        for ( const e of edges ) uf.union( keyOf( e.from ), keyOf( e.to ) );
        for ( const n of nodes ) {
            if ( n.parentId != null ) uf.union( `node:${n.id}`, `node:${n.parentId}` );
        }
        for ( const a of actions ) uf.union( `action:${a.id}`, `node:${a.originNodeId}` );
        for ( const c of conditions ) uf.union( `condition:${c.id}`, `action:${c.originActionId}` );

        const rootByKey = new Map<string, string>();
        for ( const [ root, keys ] of uf.groups() ) {
            for ( const key of keys ) rootByKey.set( key, root );
        }

        const boundsByRoot = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
        const ensureBounds = ( root: string ) => {
            let bounds = boundsByRoot.get( root );
            if ( !bounds ) {
                bounds = {
                    minX: Number.POSITIVE_INFINITY,
                    minY: Number.POSITIVE_INFINITY,
                    maxX: Number.NEGATIVE_INFINITY,
                    maxY: Number.NEGATIVE_INFINITY,
                };
                boundsByRoot.set( root, bounds );
            }
            return bounds;
        };

        for ( const n of nodes ) {
            const root = rootByKey.get( `node:${n.id}` );
            if ( !root ) continue;
            const m = getNodeSizeCached( n );
            expand( ensureBounds( root ), n.x, n.y, m.w, m.h );
        }

        for ( const a of actions ) {
            const root = rootByKey.get( `action:${a.id}` );
            if ( !root ) continue;
            const m = getActionSizeCached( a );
            expand( ensureBounds( root ), a.x, a.y, m.w, m.h );
        }

        for ( const c of conditions ) {
            const root = rootByKey.get( `condition:${c.id}` );
            if ( !root ) continue;
            const m = getConditionSizeCached( c );
            expand( ensureBounds( root ), c.x, c.y, m.w, m.h );
        }

        const pad = 34;
        return Array.from( boundsByRoot.entries() )
            .filter( ( [ , b ] ) => Number.isFinite( b.minX ) && Number.isFinite( b.minY ) )
            .map( ( [ id, b ] ) => ( {
                id,
                x: b.minX - pad,
                y: b.minY - pad,
                w: b.maxX - b.minX + 2 * pad,
                h: b.maxY - b.minY + 2 * pad,
            } ) )
            .sort( ( a, b ) => a.y - b.y || a.x - b.x || a.id.localeCompare( b.id ) );
    }, [ nodes, actions, conditions, edges ] );

    if ( fragments.length === 0 ) return null;

    const stroke = canvasDark ? "#93c5fd" : "#2563eb";
    const fill = canvasDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.05)";

    return (
        <g data-layer="fragment-frames" pointerEvents="none" aria-hidden="true">
            { fragments.map( ( fragment, idx ) => (
                <g key={ fragment.id }>
                    <rect
                        x={ fragment.x }
                        y={ fragment.y }
                        width={ fragment.w }
                        height={ fragment.h }
                        rx={ 10 }
                        ry={ 10 }
                        fill={ fill }
                        stroke={ stroke }
                        strokeWidth={ 2 }
                        strokeDasharray="12 8"
                    />
                    <text
                        x={ fragment.x + 14 }
                        y={ fragment.y + 22 }
                        fontSize={ 15 }
                        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
                        fontWeight={ 700 }
                        fill={ stroke }
                        style={ { userSelect: "none" } }
                    >
                        { `F${idx + 1}` }
                    </text>
                </g>
            ) ) }
        </g>
    );
}
