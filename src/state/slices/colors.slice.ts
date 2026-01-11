import type { AppState, NodeId, ActionId, ConditionId } from "../types";
import type { NodeColorPatch } from "../../model/types";

// Paleta / utilidades
import {
  H_BASE_MIN, VARIETY_MARGIN, H_STEP,
  makeHueList, sampleTone, hslToHex, pickTextHexForBg,
  forbidPair, MAX_RETRIES_PER_PAIR,
} from "../../colors/palette";

/** Util: obtiene el NodeId origen de una Condition */
function getOriginNodeIdFromCondition( s: AppState, condId: ConditionId ): NodeId | null {
  const c = s.conditions.find( x => x.id === condId );
  if ( !c ) return null;
  const a = s.actions.find( x => x.id === c.originActionId );
  if ( !a ) return null;
  return a.originNodeId ?? null;
}

/** Util: decide si un nodo tiene displayId “válido” (no vacío) */
function hasValidDisplayId( n: { displayId?: string | null } ): boolean {
  const t = ( n.displayId ?? "" ).trim();
  return t.length > 0;
}

/** Core de asignación de colores por grupos (displayId) para un conjunto de grupos */
function assignColorsForGroups( groups: string[] ) {
  // Igual que en recolorAllNodesRandomly, pero parametrizable
  const needWithMargin = Math.ceil( groups.length * ( 1 + VARIETY_MARGIN ) );
  let H = Math.max( H_BASE_MIN, 1 );

  while ( true ) {
    const hues = makeHueList( H );
    const capacityBruta = 16 * H * H;
    if ( capacityBruta < needWithMargin ) { H += H_STEP; continue; }

    const assigned = new Map<string, { fill: string; stroke: string; text: string }>();
    let ok = true;

    for ( const key of groups ) {
      let success = false;
      for ( let attempt = 0; attempt < MAX_RETRIES_PER_PAIR; attempt++ ) {
        const bgH = hues[ Math.floor( Math.random() * hues.length ) ];
        type Tier = "light" | "dark";
        const bgTier: Tier = Math.random() < 0.5 ? "light" : "dark";
        const bgTone = sampleTone( bgTier );
        const bdH = hues[ Math.floor( Math.random() * hues.length ) ];
        const bdTier: Tier = Math.random() < 0.5 ? "light" : "dark";
        const bdTone = sampleTone( bdTier );

        const pairForbidden = forbidPair( bgH, bgTone.s, bgTone.l, bdH, bdTone.s, bdTone.l );
        const sameTier = bgTier === bdTier;
        const sameVariant = bgTone.variant === bdTone.variant;
        const tooSimilar = sameTier && sameVariant;

        if ( pairForbidden ) continue;
        if ( tooSimilar ) continue;

        const fillHex = hslToHex( bgH, bgTone.s, bgTone.l );
        const strokeHex = hslToHex( bdH, bdTone.s, bdTone.l );
        const textHex = pickTextHexForBg( bgH, bgTone.s, bgTone.l );

        assigned.set( key, { fill: fillHex, stroke: strokeHex, text: textHex } );
        success = true;
        break;
      }
      if ( !success ) { ok = false; break; }
    }

    if ( ok ) return assigned;

    H += H_STEP;
    if ( H > 72 ) {
      console.warn( "[assignColorsForGroups] No se logró asignar colores; H creció demasiado. Abortando." );
      return null;
    }
  }
}

export const colorsSlice = ( set: any, get: () => AppState ) => ( {
  /**
   * Aplica colores a un nodo y PROPAGA a:
   * - todos los nodos con el mismo displayId
   * - acciones cuyo originNodeId pertenezca a esos nodos
   */
  setNodeColors: ( nodeId: NodeId, patch: NodeColorPatch ) => {
    get().captureDelta( [ "nodes", "actions" ], () => {
      const s = get();
      const src = s.nodes.find( n => n.id === nodeId );
      if ( !src ) return;

      const key = ( src.displayId ?? "" ).trim();
      const sameDispNodeIds = new Set(
        s.nodes.filter( n => ( n.displayId ?? "" ).trim() === key ).map( n => n.id )
      );

      const nextNodes = s.nodes.map( n => {
        if ( !sameDispNodeIds.has( n.id ) ) return n;
        return {
          ...n,
          colorFill: patch.fill ?? n.colorFill,
          colorStroke: patch.stroke ?? n.colorStroke,
          colorText: patch.text ?? n.colorText,
        };
      } );

      const nextActions = s.actions.map( a => {
        if ( !sameDispNodeIds.has( a.originNodeId ) ) return a;
        return {
          ...a,
          colorFill: patch.fill ?? a.colorFill,
          colorStroke: patch.stroke ?? a.colorStroke,
          colorText: patch.text ?? a.colorText,
        };
      } );

      set( { nodes: nextNodes, actions: nextActions } );
    } );
  },

  /**
   * 🔴 NUEVO: Recolorea SOLO la selección (por grupo displayId),
   * propagando a acciones de esos nodos.
   * - Si hay acciones/condiciones seleccionadas, también se incluye su nodo de origen.
   * - Si no hay nada seleccionado, no hace nada.
   * - Si algún nodo seleccionado no tiene displayId válido, se omite ese grupo.
   */
  recolorSelectionRandomly: () => {
    get().captureDelta( [ "nodes", "actions" ], () => {
      const s = get();

      // 1) Construir el conjunto de NodeId relevantes a partir de la selección
      const nodesSel = new Set<NodeId>( s.selection ?? new Set<NodeId>() );

      // Acciones seleccionadas → sumar originNodeId
      for ( const aid of ( s.selectionActions ?? new Set<ActionId>() ) ) {
        const a = s.actions.find( x => x.id === aid );
        if ( a ) nodesSel.add( a.originNodeId );
      }

      // Condiciones seleccionadas → originActionId → originNodeId
      for ( const cid of ( s.selectionConds ?? new Set<ConditionId>() ) ) {
        const nid = getOriginNodeIdFromCondition( s, cid );
        if ( nid != null ) nodesSel.add( nid );
      }

      if ( nodesSel.size === 0 ) {
        // Nada seleccionado → nada que hacer
        return;
      }

      // 2) Mapear a grupos por displayId (únicamente válidos)
      const groupByDisp = new Map<string, number[]>(); // displayId -> nodeIds (seleccionados)
      for ( const nid of nodesSel ) {
        const n = s.nodes.find( x => x.id === nid );
        if ( !n ) continue;
        if ( !hasValidDisplayId( n ) ) continue;
        const key = n.displayId!.trim();
        if ( !groupByDisp.has( key ) ) groupByDisp.set( key, [] );
        groupByDisp.get( key )!.push( nid );
      }

      const groups = Array.from( groupByDisp.keys() );
      if ( groups.length === 0 ) {
        console.warn( "[recolorSelectionRandomly] Ningún seleccionado tiene displayId válido." );
        return;
      }

      // 3) Asignar colores sólo para esos grupos
      const assigned = assignColorsForGroups( groups );
      if ( !assigned ) return;

      // 4) Aplicar sólo a los nodos de los grupos seleccionados
      const groupKeyOfNodeId = ( nid: number ): string | null => {
        const n = s.nodes.find( x => x.id === nid );
        if ( !n ) return null;
        const k = ( n.displayId ?? "" ).trim();
        return groups.includes( k ) ? k : null;
      };

      const nextNodes = s.nodes.map( n => {
        const k = ( n.displayId ?? "" ).trim();
        if ( !groups.includes( k ) ) return n; // no está en los grupos de la selección
        const c = assigned.get( k );
        if ( !c ) return n;
        return { ...n, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
      } );

      // 5) Propagar a acciones de nodos dentro de esos grupos
      const nextActions = s.actions.map( a => {
        const k = groupKeyOfNodeId( a.originNodeId );
        if ( !k ) return a;
        const c = assigned.get( k );
        if ( !c ) return a;
        return { ...a, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
      } );

      set( { nodes: nextNodes, actions: nextActions } );
    } );
  },

  /**
   * Recolorea TODOS los nodos por grupo de displayId (global).
   */
  recolorAllNodesRandomly: () => {
    get().captureDelta( [ "nodes", "actions" ], () => {
      const s = get();

      // Validación: displayId obligatorio
      const invalidIds = s.nodes
        .filter( n => !n.displayId || n.displayId.trim().length === 0 )
        .map( n => n.id );
      if ( invalidIds.length > 0 ) {
        console.error( "[recolorAllNodesRandomly] displayId faltante o vacío en nodos:", invalidIds );
        return;
      }

      // Grupos por displayId (todos)
      const byDisp = new Map<string, number[]>(); // displayId -> nodeIds
      for ( const n of s.nodes ) {
        const key = n.displayId!.trim();
        if ( !byDisp.has( key ) ) byDisp.set( key, [] );
        byDisp.get( key )!.push( n.id );
      }

      const groups = Array.from( byDisp.keys() );
      const assigned = assignColorsForGroups( groups );
      if ( !assigned ) return;

      const nextNodes = s.nodes.map( n => {
        const key = n.displayId!.trim();
        const c = assigned.get( key );
        if ( !c ) return n;
        return { ...n, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
      } );

      const nextActions = s.actions.map( a => {
        const key = s.nodes.find( nn => nn.id === a.originNodeId )?.displayId?.trim();
        if ( !key ) return a;
        const c = assigned.get( key );
        if ( !c ) return a;
        return { ...a, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
      } );

      set( { nodes: nextNodes, actions: nextActions } );
    } );
  },
} );
