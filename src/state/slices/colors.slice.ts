import type { StateCreator } from "zustand";
import type { AppState, NodeId, ActionId } from "../types";
import type { NodeColorPatch } from "../../model/types";

// Paleta / utilidades
import {
  randBetween, sampleTone, hslToHex, pickDarkTextHexForBg,
  forbidPair, MAX_RETRIES_PER_PAIR,
  LIGHT_RANGE_BG, LIGHT_RANGE_BORDER_LIGHT, LIGHT_RANGE_DARK,
} from "../../colors/palette";

/** Util: decide si un nodo tiene displayId “válido” (no vacío) */
function hasValidDisplayId( n: { displayId?: string | null } ): boolean {
  const t = ( n.displayId ?? "" ).trim();
  return t.length > 0;
}

/** Core de asignación de colores por grupos (displayId) para un conjunto de grupos */
function assignColorsForGroups( groups: string[] ) {
  const assigned = new Map<string, { fill: string; stroke: string; text: string }>();
  const MAX_RESTARTS = 6;

  for ( let restart = 0; restart < MAX_RESTARTS; restart++ ) {
    assigned.clear();
    let ok = true;

    for ( const key of groups ) {
      let success = false;
      for ( let attempt = 0; attempt < MAX_RETRIES_PER_PAIR; attempt++ ) {
        const bgH = randBetween( 0, 360 );
        type Tier = "light" | "dark";

        // Fondo SIEMPRE claro
        const bgTier: Tier = "light";
        const bgTone = sampleTone( bgTier, LIGHT_RANGE_BG );

        const bdH = randBetween( 0, 360 );
        const bdTier: Tier = Math.random() < 0.5 ? "light" : "dark";
        const bdTone = sampleTone(
          bdTier,
          bdTier === "light" ? LIGHT_RANGE_BORDER_LIGHT : LIGHT_RANGE_DARK
        );

        const pairForbidden = forbidPair( bgH, bgTone.s, bgTone.l, bdH, bdTone.s, bdTone.l );
        const sameTier = bgTier === bdTier;
        const sameVariant = bgTone.variant === bdTone.variant;
        const tooSimilar = sameTier && sameVariant;

        if ( pairForbidden ) continue;
        if ( tooSimilar ) continue;

        const fillHex = hslToHex( bgH, bgTone.s, bgTone.l );
        const strokeHex = hslToHex( bdH, bdTone.s, bdTone.l );

        // Texto SIEMPRE oscuro (pero NO fijo)
        const textHex = pickDarkTextHexForBg( bgH, bgTone.s, bgTone.l );

        assigned.set( key, { fill: fillHex, stroke: strokeHex, text: textHex } );
        success = true;
        break;
      }
      if ( !success ) { ok = false; break; }
    }

    if ( ok ) return assigned;
  }

  console.warn( "[assignColorsForGroups] No se logró asignar colores; reintentos agotados." );
  return null;
}

export type ColorsSlice = {
  setNodeColors: ( nodeId: NodeId, patch: NodeColorPatch ) => void;
  recolorSelectionRandomly: () => void;
  recolorAllNodesRandomly: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const colorsSlice: StateCreator<AppState, [], [], ColorsSlice> = ( set, get, _api ) => ( {
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
   * Recolorea SOLO la selección (por grupo displayId),
   * propagando a acciones de esos nodos.
   *
   * ✅ Importante:
   * - Las CONDITIONS NO se colorean.
   * - Si se selecciona una CONDITION y se pide recolorear, NO se propaga hacia atrás.
   * - La propagación hacia atrás (action → originNodeId) SÓLO aplica a ACTIONS.
   */
  recolorSelectionRandomly: () => {
    get().captureDelta( [ "nodes", "actions" ], () => {
      const s = get();

      // 1) Construir el conjunto de NodeId relevantes a partir de la selección
      const nodesSel = new Set<NodeId>( s.selection ?? new Set<NodeId>() );

      // ✅ Acciones seleccionadas → sumar originNodeId (propagación permitida)
      for ( const aid of ( s.selectionActions ?? new Set<ActionId>() ) ) {
        const a = s.actions.find( x => x.id === aid );
        if ( a ) nodesSel.add( a.originNodeId );
      }

      // ❌ Condiciones seleccionadas: se ignoran (no colorean, no propagan)

      if ( nodesSel.size === 0 ) {
        // Nada seleccionable para colorear (p. ej. sólo conditions)
        return;
      }

      // 2) Mapear a grupos por displayId (únicamente válidos)
      const groupByDisp = new Map<string, number[]>(); // displayId -> nodeIds
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
        if ( !groups.includes( k ) ) return n;
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
