// src/physics/force-simulator.ts
export type Vec2 = { x: number; y: number };

export type NodeInput = { id: string; base: Vec2; rootId?: string };
export type Edge = { from: string; to: string };

export type SimulatorOptions = {
    springK?: number;
    equilibriumDist?: number;
    coulombC?: number;
    frictionGamma?: number;
    timeStep?: number;
    dtMin?: number;
    dtMax?: number;
    maxDisplacement?: number;
    threshHigh?: number;
    threshLow?: number;
    adjustPercent?: number;
};

export class ForceSimulator {
    private nodes = new Map<string, NodeInput>();
    private edges: Edge[] = [];
    private opts: Required<SimulatorOptions>;
    private dt: number;

    // Dinámica por raíz (sólo NODOS)
    private nodeRoots = new Set<string>();
    private idToRoot = new Map<string, string>();
    private posByRoot = new Map<string, Vec2>();
    private velByRoot = new Map<string, Vec2>();

    // Dinámica por partícula (ACCIONES y CONDICIONES)
    private posById = new Map<string, Vec2>();
    private velById = new Map<string, Vec2>();
    private isParticle = new Set<string>(); // ids que NO van por raíz

    // Filtro de movibles (anclaje del resto)
    private movable?: Set<string>;
    private movableRoots?: Set<string>;

    // ⬇️ NUEVO: componente conexa por id (índice entero)
    private compById = new Map<string, number>();

    constructor (
        nodes: NodeInput[],
        edges: Edge[],
        opts: SimulatorOptions = {},
        movable?: Set<string> // ids movibles (N./A./C.); undefined => todos movibles
    ) {
        const d: Required<SimulatorOptions> = {
            springK: 1e-4,
            equilibriumDist: 140,
            coulombC: 1200,
            frictionGamma: 0.2,
            timeStep: 1,
            dtMin: 0.01,
            dtMax: 20,
            maxDisplacement: 50,
            threshHigh: 50,
            threshLow: 10,
            adjustPercent: 0.1,
        };
        this.opts = { ...d, ...( opts ?? {} ) };
        this.dt = this.opts.timeStep;

        // registrar nodos y aristas
        for ( const n of nodes ) this.nodes.set( n.id, n );
        this.edges = edges;

        // clasificar: si tiene rootId => va por raíz; si no => partícula
        for ( const n of nodes ) {
            if ( n.rootId ) {
                const r = n.rootId;
                this.idToRoot.set( n.id, r );
                this.nodeRoots.add( r );
            } else {
                this.isParticle.add( n.id );
                this.posById.set( n.id, { x: 0, y: 0 } );
                this.velById.set( n.id, { x: 0, y: 0 } );
            }
        }
        for ( const r of this.nodeRoots ) {
            this.posByRoot.set( r, { x: 0, y: 0 } );
            this.velByRoot.set( r, { x: 0, y: 0 } );
        }

        // Filtro de movibles / anclaje
        this.movable = movable;
        if ( this.movable ) {
            const roots = new Set<string>();
            for ( const id of this.movable ) {
                if ( this.isParticle.has( id ) ) continue; // partículas: se filtran por-id
                const r = this.idToRoot.get( id ) ?? id; // si ya es raíz, queda tal cual
                roots.add( r );
            }
            this.movableRoots = roots;
        }

        // ⬇️ NUEVO: calcular componentes conexas (no dirigidas)
        this.buildConnectedComponents();
    }

    // ⬇️ NUEVO: componentes conexas sobre el grafo no dirigido
    private buildConnectedComponents() {
        // Adyacencias no dirigidas
        const adj = new Map<string, Set<string>>();
        const ensure = ( id: string ) => {
            if ( !adj.has( id ) ) adj.set( id, new Set<string>() );
        };

        // Todos los nodos como claves (incluye aislados)
        for ( const id of this.nodes.keys() ) ensure( id );

        // Aristas bidireccionales
        for ( const e of this.edges ) {
            ensure( e.from );
            ensure( e.to );
            adj.get( e.from )!.add( e.to );
            adj.get( e.to )!.add( e.from );
        }

        // DFS/BFS para etiquetar componentes
        const compById = new Map<string, number>();
        let compIdx = 0;
        for ( const id of adj.keys() ) {
            if ( compById.has( id ) ) continue;
            compIdx++;
            const stack = [ id ];
            compById.set( id, compIdx );
            while ( stack.length ) {
                const u = stack.pop()!;
                for ( const v of adj.get( u )! ) {
                    if ( !compById.has( v ) ) {
                        compById.set( v, compIdx );
                        stack.push( v );
                    }
                }
            }
        }
        this.compById = compById;
    }

    private cur( id: string ): Vec2 {
        const n = this.nodes.get( id );
        if ( !n ) throw new Error( `Unknown node id: ${id}` );
        if ( this.isParticle.has( id ) ) {
            const p = this.posById.get( id )!;
            return { x: n.base.x + p.x, y: n.base.y + p.y };
        }
        const r = this.idToRoot.get( id )!;
        const pr = this.posByRoot.get( r )!;
        return { x: n.base.x + pr.x, y: n.base.y + pr.y };
    }

    step(): void {
        const { springK, equilibriumDist, coulombC, frictionGamma } = this.opts;

        // fuerzas por-id
        const force = new Map<string, Vec2>();
        for ( const id of this.nodes.keys() ) force.set( id, { x: 0, y: 0 } );

        // resortes (todas las aristas cuentan)
        for ( const e of this.edges ) {
            const p1 = this.cur( e.from );
            const p2 = this.cur( e.to );
            const dx = p2.x - p1.x,
                dy = p2.y - p1.y;
            const dist = Math.hypot( dx, dy ) || 1e-6;
            const dif = dist - equilibriumDist;
            const fs = springK * dif; // fuerza lineal
            const fx = ( fs * dx ) / dist,
                fy = ( fs * dy ) / dist;
            const f1 = force.get( e.from )!;
            f1.x += fx;
            f1.y += fy;
            const f2 = force.get( e.to )!;
            f2.x -= fx;
            f2.y -= fy;
        }

        // repulsión O(N²) — SOLO dentro de la misma componente conexa
        const ids = [ ...this.nodes.keys() ];
        for ( let i = 0; i < ids.length; i++ ) {
            for ( let j = i + 1; j < ids.length; j++ ) {
                const a = ids[ i ],
                    b = ids[ j ];

                // ⬇️ NUEVO: filtrar por componente
                if ( this.compById.get( a ) !== this.compById.get( b ) ) continue;

                const pa = this.cur( a ),
                    pb = this.cur( b );
                const dx = pb.x - pa.x,
                    dy = pb.y - pa.y;

                // rompe simetrías exactas con un micro desplazamiento determinista
                let ddx = dx,
                    ddy = dy;
                if ( ddx === 0 && ddy === 0 ) {
                    const h = ( ( a.charCodeAt( 0 ) ^ b.charCodeAt( 0 ) ) % 31 ) - 15; // -15..15
                    const ang = ( h === 0 ? 1 : h ) * 0.01;
                    ddx = Math.cos( ang ) * 1e-3;
                    ddy = Math.sin( ang ) * 1e-3;
                }

                const d2 = ddx * ddx + ddy * ddy;
                const invd = 1 / Math.sqrt( d2 );
                const f = coulombC / d2;
                const fx = f * ddx * invd,
                    fy = f * ddy * invd;

                const fa = force.get( a )!;
                fa.x -= fx;
                fa.y -= fy;
                const fb = force.get( b )!;
                fb.x += fx;
                fb.y += fy;
            }
        }

        let maxDisp = 0;

        // integrar raíces (NODOS) — acumulamos fuerzas por raíz
        const rootF = new Map<string, Vec2>();
        for ( const r of this.nodeRoots ) rootF.set( r, { x: 0, y: 0 } );
        for ( const id of ids ) {
            if ( this.isParticle.has( id ) ) continue;
            const r = this.idToRoot.get( id )!;
            const F = rootF.get( r )!;
            const f = force.get( id )!;
            F.x += f.x;
            F.y += f.y;
        }

        for ( const r of this.nodeRoots ) {
            // ⛓️ anclaje por raíz
            if ( this.movableRoots && !this.movableRoots.has( r ) ) continue;

            const p = this.posByRoot.get( r )!,
                v = this.velByRoot.get( r )!,
                F = rootF.get( r )!;
            v.x += ( F.x - frictionGamma * v.x ) * this.dt;
            v.y += ( F.y - frictionGamma * v.y ) * this.dt;
            let dx = v.x * this.dt,
                dy = v.y * this.dt;
            const disp = Math.hypot( dx, dy );
            if ( disp > this.opts.maxDisplacement ) {
                const s = this.opts.maxDisplacement / disp;
                dx *= s;
                dy *= s;
            }
            p.x += dx;
            p.y += dy;
            if ( disp > maxDisp ) maxDisp = disp;
        }

        // integrar partículas (ACCIONES y CONDICIONES) — anclaje por id
        for ( const id of ids ) {
            if ( !this.isParticle.has( id ) ) continue;
            if ( this.movable && !this.movable.has( id ) ) continue; // ⛓️ anclado

            const v = this.velById.get( id )!,
                p = this.posById.get( id )!;
            const f = force.get( id )!;
            v.x += ( f.x - frictionGamma * v.x ) * this.dt;
            v.y += ( f.y - frictionGamma * v.y ) * this.dt;
            let dx = v.x * this.dt,
                dy = v.y * this.dt;
            const disp = Math.hypot( dx, dy );
            if ( disp > this.opts.maxDisplacement ) {
                const s = this.opts.maxDisplacement / disp;
                dx *= s;
                dy *= s;
            }
            p.x += dx;
            p.y += dy;
            if ( disp > maxDisp ) maxDisp = disp;
        }

        // dt adaptativo
        const { dtMin, dtMax, adjustPercent, threshHigh, threshLow } = this.opts;
        if ( maxDisp > threshHigh ) this.dt = Math.max( dtMin, this.dt * ( 1 - adjustPercent ) );
        else if ( maxDisp < threshLow ) this.dt = Math.min( dtMax, this.dt * ( 1 + adjustPercent ) );
    }

    run( n: number ) {
        for ( let i = 0; i < n; i++ ) this.step();
    }

    getPositions(): Record<string, Vec2> {
        const out: Record<string, Vec2> = {};
        for ( const [ id, n ] of this.nodes.entries() ) {
            if ( this.isParticle.has( id ) ) {
                const p = this.posById.get( id )!;
                out[ id ] = { x: n.base.x + p.x, y: n.base.y + p.y };
            } else {
                const r = this.idToRoot.get( id )!;
                const pr = this.posByRoot.get( r )!;
                out[ id ] = { x: n.base.x + pr.x, y: n.base.y + pr.y };
            }
        }
        return out;
    }
}
