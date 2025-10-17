import type { NodeColorPatch } from "../../model/types";
import type { AppState, NodeId } from "../types";

export const colorsSlice = ( set: any ) =>
( {
  // Propaga colores del nodo a sus acciones y condiciones descendientes (por copia)
  setNodeColors: ( id: NodeId, colors: NodeColorPatch ): void => {
    set( ( s: AppState ): Partial<AppState> => {
      // 1) actualizar el nodo
      const nextNodes = s.nodes.map( ( n ) =>
        n.id !== id
          ? n
          : {
            ...n,
            colorFill: colors.fill ?? n.colorFill,
            colorStroke: colors.stroke ?? n.colorStroke,
            colorText: colors.text ?? n.colorText,
          }
      );

      // 2) acciones del nodo
      const affectedActions = new Set( s.actions.filter( ( a ) => a.originNodeId === id ).map( ( a ) => a.id ) );

      const nextActions = s.actions.map( ( a ) =>
        affectedActions.has( a.id )
          ? {
            ...a,
            colorFill: colors.fill ?? a.colorFill,
            colorStroke: colors.stroke ?? a.colorStroke,
            colorText: colors.text ?? a.colorText, // <- texto heredado
          }
          : a
      );

      return { nodes: nextNodes, actions: nextActions };
    } );
  },
} satisfies Partial<AppState> );
