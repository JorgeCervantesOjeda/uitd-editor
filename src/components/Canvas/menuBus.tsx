// src/components/Canvas/menuBus.tsx
import { createContext, useContext } from "react";

export type MenuBus = {
    openNodeMenu: ( screenX: number, screenY: number, nodeId: number ) => void;
    openActionMenu: ( screenX: number, screenY: number, actionId: number ) => void;
    openConditionMenu: ( screenX: number, screenY: number, conditionId: number ) => void;

    openNodeEditDialog: ( nodeId: number ) => void;
    openActionEditDialog: ( actionId: number ) => void;
    openConditionEditDialog: ( conditionId: number ) => void;

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
