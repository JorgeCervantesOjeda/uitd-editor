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
    setConditionMenu
}: Props ) {
    const addActionForNode = useAppStore( s => s.addActionForNode );
    const deleteSelected = useAppStore( s => s.deleteSelected );
    const handleCreateCondition = useAppStore( s => s.handleCreateCondition );
    const retargetCondition = useAppStore( s => s.retargetCondition );

    const beginGoToTarget = useAppStore( s => s.beginGoToTarget );
    const renameNode = useAppStore( s => s.renameNode );
    const renameAction = useAppStore( s => s.renameAction );
    const renameCondition = useAppStore( s => s.renameCondition );
    const setNodeColors = useAppStore( s => s.setNodeColors );

    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );

    // NUEVO: leer edges y calcular si mostrar "Go to target"
    const edges = useAppStore( s => s.edges );
    const showGoToTarget =
        actionMenu.open &&
        actionMenu.id != null &&
        !edges.some( e => e.from.kind === "action" && e.from.id === actionMenu.id );

    const box = ( left: number, top: number, children: React.ReactNode ) => (
        <div
            style={ {
                position: "fixed",
                left, top,
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
            { canvasMenu.open && box( canvasMenu.x, canvasMenu.y, (
                <button
                    onClick={ () => {
                        onCreateNode();
                        setCanvasMenu( { open: false, x: 0, y: 0 } );
                    } }
                >
                    New node
                </button>
            ) ) }

            {/* Node menu (ahora incluye pickers de color) */ }
            { nodeMenu.open && nodeMenu.id != null && box( nodeMenu.x, nodeMenu.y, (
                <>
                    <button onClick={ () => { addActionForNode( nodeMenu.id! ); setNodeMenu( { ...nodeMenu, open: false } ); } }>
                        Add action
                    </button>

                    {/* Pickers de color */ }
                    { ( () => {
                        const n = nodes.find( n0 => n0.id === nodeMenu.id );
                        if ( !n ) return null;
                        const fill = n.colorFill ?? "#f1f5f9";
                        const stroke = n.colorStroke ?? "#94a3b8";
                        const text = n.colorText ?? "#334155";
                        return (
                            <div style={ { display: "grid", gap: 6 } }>
                                <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                                    <span style={ { width: 110 } }>Background</span>
                                    <input
                                        type="color"
                                        value={ fill }
                                        onChange={ ( e ) => setNodeColors( n.id, { fill: e.target.value } ) }
                                    />
                                </label>
                                <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                                    <span style={ { width: 110 } }>Border</span>
                                    <input
                                        type="color"
                                        value={ stroke }
                                        onChange={ ( e ) => setNodeColors( n.id, { stroke: e.target.value } ) }
                                    />
                                </label>
                                <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                                    <span style={ { width: 110 } }>Text</span>
                                    <input
                                        type="color"
                                        value={ text }
                                        onChange={ ( e ) => setNodeColors( n.id, { text: e.target.value } ) }
                                    />
                                </label>
                            </div>
                        );
                    } )() }

                    <button onClick={ () => {
                        const n = nodes.find( n0 => n0.id === nodeMenu.id );
                        if ( !n ) return;
                        const t = window.prompt( "Rename node title:", n.title );
                        if ( t != null ) renameNode( n.id, t );
                        setNodeMenu( { ...nodeMenu, open: false } );
                    } }>
                        Rename
                    </button>

                    <button onClick={ () => { deleteSelected(); setNodeMenu( { ...nodeMenu, open: false } ); } }>
                        Delete
                    </button>
                </>
            ) ) }

            {/* Action menu */ }
            { actionMenu.open && actionMenu.id != null && box( actionMenu.x, actionMenu.y, (
                <>
                    <button onClick={ () => { handleCreateCondition( actionMenu.id! ); setActionMenu( { ...actionMenu, open: false } ); } }>
                        Add condition
                    </button>

                    {/* NUEVO: ocultar si no aplica */ }
                    { showGoToTarget && (
                        <button onClick={ () => {
                            beginGoToTarget( actionMenu.id! );
                            setActionMenu( { ...actionMenu, open: false } );
                        } }>
                            Go to target
                        </button>
                    ) }

                    <button onClick={ () => {
                        const a = actions.find( a0 => a0.id === actionMenu.id );
                        if ( !a ) return;
                        const t = window.prompt( "Rename action:", a.title );
                        if ( t != null ) renameAction( a.id, t );
                        setActionMenu( { ...actionMenu, open: false } );
                    } }>
                        Rename
                    </button>

                    <button onClick={ () => { deleteSelected(); setActionMenu( { ...actionMenu, open: false } ); } }>
                        Delete
                    </button>
                </>
            ) ) }

            {/* Condition menu */ }
            { conditionMenu.open && conditionMenu.id != null && box( conditionMenu.x, conditionMenu.y, (
                <>
                    <button onClick={ () => {
                        retargetCondition( conditionMenu.id! );
                        setConditionMenu( { ...conditionMenu, open: false } );
                    } }>
                        Go to target
                    </button>
                    <button onClick={ () => {
                        const c = conditions.find( c0 => c0.id === conditionMenu.id );
                        if ( !c ) return;
                        const t = window.prompt( "Rename condition:", c.title );
                        if ( t != null ) renameCondition( c.id, t );
                        setConditionMenu( { ...conditionMenu, open: false } );
                    } }>
                        Rename
                    </button>
                    <button onClick={ () => { deleteSelected(); setConditionMenu( { ...conditionMenu, open: false } ); } }>
                        Delete
                    </button>
                </>
            ) ) }
        </>
    );
}
