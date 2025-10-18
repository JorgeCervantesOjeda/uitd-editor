import type { AppState, NodeId } from "../types";
import type { NodeColorPatch } from "../../model/types";

// src/state/colors.slice.ts


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

    // Clave de grupo por displayId (fallback al id si no tiene)
    const key = ( src.displayId ?? String( src.id ) ).trim();

    // Todos los nodos que comparten ese displayId
    const sameDispNodeIds = new Set(
      s.nodes
        .filter( n => ( n.displayId ?? String( n.id ) ).trim() === key )
        .map( n => n.id )
    );

    // Propagar a nodos
    const nextNodes = s.nodes.map( n => {
      if ( !sameDispNodeIds.has( n.id ) ) return n;
      return {
        ...n,
        colorFill: patch.fill ?? n.colorFill,
        colorStroke: patch.stroke ?? n.colorStroke,
        colorText: patch.text ?? n.colorText,
      };
    } );

    // Propagar a acciones de esos nodos
    const nextActions = s.actions.map( a => {
      if ( !sameDispNodeIds.has( a.originNodeId ) ) return a;
      return {
        ...a,
        colorFill: patch.fill ?? a.colorFill,
        colorStroke: patch.stroke ?? a.colorStroke,
        colorText: patch.text ?? a.colorText,
      };
    } );

    // Condiciones: no se modifican
    set( { nodes: nextNodes, actions: nextActions } );
  },
} );
