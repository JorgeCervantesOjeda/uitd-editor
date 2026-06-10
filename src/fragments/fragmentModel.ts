import type { ActionLabel, ConditionLabel, Edge, EdgeEndpoint, NodeBox } from "../model/types";

export type FragmentGroup = {
    id: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
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

function numericSuffix( key: string, prefix: string ): number | null {
    if ( !key.startsWith( prefix ) ) return null;
    const n = Number( key.slice( prefix.length ) );
    return Number.isFinite( n ) ? n : null;
}

function makeFragmentId( keys: string[] ): string {
    return keys.slice().sort( ( a, b ) => a.localeCompare( b ) ).join( "|" );
}

export function buildFragmentGroups( input: {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
} ): FragmentGroup[] {
    const { nodes, actions, conditions, edges } = input;
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

    return Array.from( uf.groups().values() )
        .map( ( keys ) => {
            const nodeIds = keys
                .map( key => numericSuffix( key, "node:" ) )
                .filter( ( id ): id is number => id != null )
                .sort( ( a, b ) => a - b );
            const actionIds = keys
                .map( key => numericSuffix( key, "action:" ) )
                .filter( ( id ): id is number => id != null )
                .sort( ( a, b ) => a - b );
            const conditionIds = keys
                .map( key => numericSuffix( key, "condition:" ) )
                .filter( ( id ): id is number => id != null )
                .sort( ( a, b ) => a - b );

            return {
                id: makeFragmentId( keys ),
                nodeIds,
                actionIds,
                conditionIds,
            };
        } )
        .sort( ( a, b ) => {
            const aFirst = a.nodeIds[ 0 ] ?? Number.POSITIVE_INFINITY;
            const bFirst = b.nodeIds[ 0 ] ?? Number.POSITIVE_INFINITY;
            return aFirst - bFirst || a.id.localeCompare( b.id );
        } );
}

export function defaultFragmentTitle( index: number ): string {
    return `Fragment ${index + 1}`;
}

export function resolveFragmentTitle(
    titles: Record<string, string> | undefined,
    fragmentId: string,
    index: number
): string {
    const title = titles?.[ fragmentId ]?.trim();
    return title || defaultFragmentTitle( index );
}
