// src/components/Canvas/renderMenus.tsx
// Renderiza los menús contextuales (Canvas, Node, Action, Condition)

import { useAppStore } from "../../state/store";
import type {
    CanvasMenuState,
    NodeMenuState,
    ActionMenuState,
    ConditionMenuState
} from "./contextmenus";

type Props = {
    canvasMenu: CanvasMenuState;
    nodeMenu: NodeMenuState;
    actionMenu: ActionMenuState;
    conditionMenu: ConditionMenuState;
    onCreateNode: () => void;
    setCanvasMenu: ( s: CanvasMenuState ) => void;
    setNodeMenu: ( s: NodeMenuState ) => void;
    setActionMenu: ( s: ActionMenuState ) => void;
    setConditionMenu: ( s: ConditionMenuState ) => void;
    openNodeEditDialog: ( id: number ) => void;
};

export function renderMenus( {
    canvasMenu,
    nodeMenu,
    actionMenu,
    conditionMenu,
    onCreateNode,
    setCanvasMenu,
    setNodeMenu,
    setActionMenu,
    setConditionMenu,
    openNodeEditDialog
}: Props ) {
    const addActionForNode = useAppStore( s => s.addActionForNode );
    const deleteSelected = useAppStore( s => s.deleteSelected );
    const handleCreateCondition = useAppStore( s => s.handleCreateCondition );
    const retargetCondition = useAppStore( s => s.retargetCondition );

    const beginGoToTarget = useAppStore( s => s.beginGoToTarget );
    const renameAction = useAppStore( s => s.renameAction );
    const renameCondition = useAppStore( s => s.renameCondition );

    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );

    const box = ( left: number, top: number, children: React.ReactNode ) => (
        <div
            style={ {
                position: "fixed",
                left,
                top,
                background: "white",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: 8,
                boxShadow: "0 6px 24px rgba(2,6,23,.15)",
                zIndex: 50,
                display: "grid",
                gap: 6,
                minWidth: 220
            } }
        >
            { children }
        </div>
    );

    return (
        <>
            {/* Canvas menu: SOLO New node */ }
            { canvasMenu.open &&
                box(
                    canvasMenu.x,
                    canvasMenu.y,
                    <button
                        onClick={ () => {
                            onCreateNode();
                            setCanvasMenu( { open: false, x: 0, y: 0 } );
                        } }
                    >
                        New node
                    </button>
                ) }

            { nodeMenu.open &&
                nodeMenu.id != null &&
                box(
                    nodeMenu.x,
                    nodeMenu.y,
                    <>
                        <button
                            onClick={ () => {
                                addActionForNode( nodeMenu.id! );
                                setNodeMenu( { ...nodeMenu, open: false } );
                            } }
                        >
                            Add action
                        </button>

                        <button
                            onClick={ () => {
                                setNodeMenu( { ...nodeMenu, open: false } );
                                openNodeEditDialog( nodeMenu.id! ); // title/displayId/colors
                            } }
                        >
                            Edit…
                        </button>

                        <button
                            onClick={ () => {
                                deleteSelected();
                                setNodeMenu( { ...nodeMenu, open: false } );
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }

            {/* Action menu */ }
            { actionMenu.open &&
                actionMenu.id != null &&
                box(
                    actionMenu.x,
                    actionMenu.y,
                    <>
                        <button
                            onClick={ () => {
                                handleCreateCondition( actionMenu.id! );
                                setActionMenu( { ...actionMenu, open: false } );
                            } }
                        >
                            Add condition
                        </button>

                        {/* SIEMPRE visible: ahora beginGoToTarget podará edges y arrancará el rubber band */ }
                        <button
                            onClick={ () => {
                                beginGoToTarget( actionMenu.id! );
                                setActionMenu( { ...actionMenu, open: false } );
                            } }
                        >
                            Go to target
                        </button>

                        <button
                            onClick={ () => {
                                const a = actions.find( a0 => a0.id === actionMenu.id );
                                if ( !a ) return;
                                const t = window.prompt( "Rename action:", a.title );
                                if ( t != null ) renameAction( a.id, t );
                                setActionMenu( { ...actionMenu, open: false } );
                            } }
                        >
                            Rename
                        </button>

                        <button
                            onClick={ () => {
                                deleteSelected();
                                setActionMenu( { ...actionMenu, open: false } );
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }

            {/* Condition menu */ }
            { conditionMenu.open &&
                conditionMenu.id != null &&
                box(
                    conditionMenu.x,
                    conditionMenu.y,
                    <>
                        <button
                            onClick={ () => {
                                retargetCondition( conditionMenu.id! );
                                setConditionMenu( { ...conditionMenu, open: false } );
                            } }
                        >
                            Go to target
                        </button>
                        <button
                            onClick={ () => {
                                const c = conditions.find( c0 => c0.id === conditionMenu.id );
                                if ( !c ) return;
                                const t = window.prompt( "Rename condition:", c.title );
                                if ( t != null ) renameCondition( c.id, t );
                                setConditionMenu( { ...conditionMenu, open: false } );
                            } }
                        >
                            Rename
                        </button>
                        <button
                            onClick={ () => {
                                deleteSelected();
                                setConditionMenu( { ...conditionMenu, open: false } );
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }
        </>
    );
}
