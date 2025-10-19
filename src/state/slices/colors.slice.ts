// src/state/colors.slice.ts
import type { AppState, NodeId } from "../types";
import type { NodeColorPatch } from "../../model/types";

// ⬇️ NUEVO: utilidades/constantes de color
import {
  H_BASE_MIN, VARIETY_MARGIN, H_STEP,
  makeHueList, sampleTone, hslToHex, pickTextHexForBg,
  forbidPair, MAX_RETRIES_PER_PAIR,
} from "../../colors/palette";

export const colorsSlice = ( set: any, get: () => AppState ) => ( {
  /**
   * Aplica colores a un nodo y PROPAGA a:
   * - todos los nodos con el mismo displayId (en cualquier nivel, anidados incluidos)
   * - todas las acciones cuyo originNodeId pertenezca a esos nodos
   * (Condiciones NO se tocan)
   */
  setNodeColors: ( nodeId: NodeId, patch: NodeColorPatch ) => {
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
  },

  /**
   * Recolorea TODOS los nodos por grupo de displayId (aleatorio, no determinista),
   * propagando a las acciones cuyo originNodeId esté en cada grupo.
   * - Reglas: solo claros/oscuros, fondo ≠ borde, lista negra (Rojo–Verde, complementarios saturados con L similar).
   * - Texto: blanco/negro según luminancia del fondo.
   * - displayId es obligatorio: aborta si falta/está vacío en algún nodo.
   */
  recolorAllNodesRandomly: () => {
    const s = get();

    // Validación: displayId obligatorio
    const invalidIds = s.nodes
      .filter( n => !n.displayId || n.displayId.trim().length === 0 )
      .map( n => n.id );
    if ( invalidIds.length > 0 ) {
      console.error( "[recolorAllNodesRandomly] displayId faltante o vacío en nodos:", invalidIds );
      return;
    }

    // Grupos por displayId
    const byDisp = new Map<string, number[]>(); // displayId -> nodeIds
    for ( const n of s.nodes ) {
      const key = n.displayId!.trim();
      if ( !byDisp.has( key ) ) byDisp.set( key, [] );
      byDisp.get( key )!.push( n.id );
    }
    const groups = Array.from( byDisp.keys() );
    const N = groups.length;

    // Bucle que aumenta H si no logramos asignar combinaciones válidas
    let H = Math.max( H_BASE_MIN, 1 );
    const needWithMargin = Math.ceil( N * ( 1 + VARIETY_MARGIN ) );

    let assigned: Map<string, { fill: string; stroke: string; text: string }> | null = null;

    while ( true ) {
      const hues = makeHueList( H );

      // Intentar asignar para todos los grupos
      const mapColors = new Map<string, { fill: string; stroke: string; text: string }>();
      let ok = true;

      // Si la capacidad bruta (16*H^2) está claramente por debajo del mínimo con margen, subimos H sin intentar
      const capacityBruta = 16 * H * H;
      if ( capacityBruta < needWithMargin ) {
        H += H_STEP;
        continue;
      }

      for ( const key of groups ) {
        // Reintentos por grupo si cae en combinaciones vetadas
        let success = false;
        for ( let attempt = 0; attempt < MAX_RETRIES_PER_PAIR; attempt++ ) {
          // Fondo: elegir hue y tone tier/variant
          const bgH = hues[ Math.floor( Math.random() * hues.length ) ];
          const bgTier = Math.random() < 0.5 ? "light" : "dark" as const;
          const bgTone = sampleTone( bgTier );

          // Borde: independiente, pero con reglas
          const bdH = hues[ Math.floor( Math.random() * hues.length ) ];
          const bdTier = Math.random() < 0.5 ? "light" : "dark" as const;
          const bdTone = sampleTone( bdTier );

          // Prohibiciones (incluye separación mínima y complementarios vibrantes)
          const pairForbidden = forbidPair( bgH, bgTone.s, bgTone.l, bdH, bdTone.s, bdTone.l );
          // Asegurar diferencia mínima adicional por tier/variante si hace falta
          const sameTier = bgTier === bdTier;
          const sameVariant = bgTone.variant === bdTone.variant;
          const tierVariantTooSimilar = ( sameTier && sameVariant );

          if ( pairForbidden ) continue;
          if ( tierVariantTooSimilar ) continue;

          // OK: calcular colores hex y texto
          const fillHex = hslToHex( bgH, bgTone.s, bgTone.l );
          const strokeHex = hslToHex( bdH, bdTone.s, bdTone.l );
          const textHex = pickTextHexForBg( bgH, bgTone.s, bgTone.l );

          mapColors.set( key, { fill: fillHex, stroke: strokeHex, text: textHex } );
          success = true;
          break;
        }
        if ( !success ) { ok = false; break; }
      }

      if ( ok ) { assigned = mapColors; break; }
      // Si no pudimos asignar a todos los grupos con este H, subimos H y reintentamos
      H += H_STEP;
      if ( H > 72 ) { // guardarraíl
        console.warn( "[recolorAllNodesRandomly] No se logró asignar colores; H creció demasiado. Abortando." );
        return;
      }
    }

    // Aplicar en una sola mutación
    if ( !assigned ) return;

    const nextNodes = s.nodes.map( n => {
      const key = n.displayId!.trim();
      const c = assigned!.get( key );
      if ( !c ) return n;
      return { ...n, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
    } );

    const groupNodeIds = new Map<string, Set<number>>();
    for ( const [ key, ids ] of byDisp.entries() ) groupNodeIds.set( key, new Set( ids ) );

    const nextActions = s.actions.map( a => {
      // buscar el grupo del originNodeId
      const key = s.nodes.find( nn => nn.id === a.originNodeId )?.displayId?.trim();
      if ( !key ) return a;
      const c = assigned!.get( key );
      if ( !c ) return a;
      return { ...a, colorFill: c.fill, colorStroke: c.stroke, colorText: c.text };
    } );

    set( { nodes: nextNodes, actions: nextActions } );
  },
} );
