import type { AppState, ActionId } from "../types";

export const colorsSlice = ( set: any ) =>
( {
    // Propaga colores del nodo a sus acciones y condiciones descendientes (por copia)
    setNodeColors: ( id: number, colors: { fill?: string; stroke?: string; text?: string } ) => {
        set( ( s: AppState ) => {
            // 1) actualizar nodo
            const nextNodes = s.nodes.map( n =>
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
            const affectedActions = new Set<ActionId>(
                s.actions.filter( a => a.originNodeId === id ).map( a => a.id )
            );

            const nextActions = s.actions.map( a =>
                affectedActions.has( a.id )
                    ? {
                        ...a,
                        colorFill: colors.fill ?? a.colorFill,
                        colorStroke: colors.stroke ?? a.colorStroke,
                    }
                    : a
            );

            // 3) condiciones de esas acciones
            const nextConds = s.conditions.map( c =>
                affectedActions.has( c.originActionId )
                    ? {
                        ...c,
                        colorFill: colors.fill ?? c.colorFill,
                        colorStroke: colors.stroke ?? c.colorStroke,
                    }
                    : c
            );

            return { nodes: nextNodes, actions: nextActions, conditions: nextConds };
        } );
    },
} satisfies Partial<AppState> );
