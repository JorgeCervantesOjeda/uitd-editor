// src/components/Canvas/menuBus.tsx
// Contexto para abrir menús contextuales desde capas (nodos/acciones/condiciones)
// sin acoplarlas al estado local de Canvas.

import { createContext, useContext } from "react";

export type MenuBus = {
    openNodeMenu: ( screenX: number, screenY: number, nodeId: number ) => void;
    openActionMenu: ( screenX: number, screenY: number, actionId: number ) => void;
    openConditionMenu: ( screenX: number, screenY: number, conditionId: number ) => void;
    closeAll: () => void;
};

const MenuBusContext = createContext<MenuBus | null>( null );

export function MenuBusProvider( {
    value,
    children,
}: {
    value: MenuBus;
    children: React.ReactNode;
} ) {
    return (
        <MenuBusContext.Provider value={ value }>
            { children }
        </MenuBusContext.Provider>
    );
}

export function useMenuBus(): MenuBus {
    const ctx = useContext( MenuBusContext );
    if ( !ctx ) {
        throw new Error( "useMenuBus must be used within <MenuBusProvider>" );
    }
    return ctx;
}
