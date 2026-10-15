// src/components/Canvas/renderMenus.tsx
import { useEffect } from "react";
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
    openActionEditDialog: ( id: number ) => void;
    onFitSelectionToView: () => void;
};

export function RenderMenus( {
    canvasMenu,
    nodeMenu,
    actionMenu,
    conditionMenu,
    onCreateNode,
    setCanvasMenu,
    setNodeMenu,
    setActionMenu,
    setConditionMenu,
    openNodeEditDialog,
    openActionEditDialog,
    onFitSelectionToView,
}: Props ) {
    const addActionForNode = useAppStore( s => s.addActionForNode );
    const deleteSelected = useAppStore( s => s.deleteSelected );
    const handleCreateCondition = useAppStore( s => s.handleCreateCondition );
    const retargetCondition = useAppStore( s => s.retargetCondition );

    const beginGoToTarget = useAppStore( s => s.beginGoToTarget );
    const renameCondition = useAppStore( s => s.renameCondition );
    const isCanvasLocked = useAppStore( s => s.isCanvasLockedByUITDLLiveSync );
    const rigidBlockAvailability = useAppStore( s => s.getRigidBlockAvailability?.() ?? {
        canCreate: false,
        canRemove: false,
        createReason: "Rigid block commands are unavailable.",
    } );
    const createRigidBlock = useAppStore( s => s.createRigidBlockFromSelection );
    const removeRigidBlock = useAppStore( s => s.removeRigidBlockFromSelection );

    const conditions = useAppStore( s => s.conditions );
    const selection = useAppStore( s => s.selection );
    const selectionActions = useAppStore( s => s.selectionActions );
    const selectionConds = useAppStore( s => s.selectionConds );
    const hasSelection = selection.size + selectionActions.size + selectionConds.size > 0;

    const hasOpenMenu = canvasMenu.open || nodeMenu.open || actionMenu.open || conditionMenu.open;

    const renderRigidBlockActions = ( closeMenu: () => void ) => {
        if ( rigidBlockAvailability.canRemove ) {
            return (
                <button
                    disabled={ isCanvasLocked }
                    title={ isCanvasLocked ? "Turn off Live to canvas to remove a rigid block" : "Remove the selected rigid block" }
                    onClick={ () => {
                        if ( isCanvasLocked ) return;
                        if ( removeRigidBlock?.() ) closeMenu();
                    } }
                >
                    Remove rigid block
                </button>
            );
        }

        return (
            <button
                disabled={ isCanvasLocked || !rigidBlockAvailability.canCreate }
                title={ isCanvasLocked
                    ? "Turn off Live to canvas to create a rigid block"
                    : rigidBlockAvailability.canCreate
                        ? "Create a rigid block from the selected elements"
                        : rigidBlockAvailability.createReason ?? "The current selection cannot form a rigid block" }
                onClick={ () => {
                    if ( isCanvasLocked || !rigidBlockAvailability.canCreate ) return;
                    const result = createRigidBlock?.();
                    if ( result?.ok ) closeMenu();
                } }
            >
                Create rigid block
            </button>
        );
    };

    useEffect( () => {
        if ( !hasOpenMenu ) return;

        function onDocumentPointerDown( e: PointerEvent ) {
            const target = e.target;
            if ( target instanceof Element && target.closest( '[data-context-menu="true"]' ) ) return;

            if ( canvasMenu.open ) setCanvasMenu( { open: false, x: 0, y: 0 } );
            if ( nodeMenu.open ) setNodeMenu( { open: false, x: 0, y: 0, id: null } );
            if ( actionMenu.open ) setActionMenu( { open: false, x: 0, y: 0, id: null } );
            if ( conditionMenu.open ) setConditionMenu( { open: false, x: 0, y: 0, id: null } );
        }

        document.addEventListener( "pointerdown", onDocumentPointerDown, true );
        return () => document.removeEventListener( "pointerdown", onDocumentPointerDown, true );
    }, [
        actionMenu.open,
        canvasMenu.open,
        conditionMenu.open,
        hasOpenMenu,
        nodeMenu.open,
        setActionMenu,
        setCanvasMenu,
        setConditionMenu,
        setNodeMenu,
    ] );

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
            data-context-menu="true"
        >
            { children }
        </div>
    );

    return (
        <>
            { canvasMenu.open &&
                box(
                    canvasMenu.x,
                    canvasMenu.y,
                    <button
                        disabled={ isCanvasLocked }
                        onClick={ () => {
                            if ( isCanvasLocked ) return;
                            onCreateNode();
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
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                addActionForNode( nodeMenu.id! );
                            } }
                        >
                            Add action
                        </button>

                        { hasSelection && (
                            <button
                                disabled={ isCanvasLocked }
                                onClick={ () => {
                                    if ( isCanvasLocked ) return;
                                    onFitSelectionToView();
                                } }
                            >
                                Fit selection to view
                            </button>
                        ) }

                        { renderRigidBlockActions( () => setNodeMenu( { open: false, x: 0, y: 0, id: null } ) ) }

                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                openNodeEditDialog( nodeMenu.id! );
                            } }
                        >
                            Edit…
                        </button>

                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                deleteSelected();
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }

            { actionMenu.open &&
                actionMenu.id != null &&
                box(
                    actionMenu.x,
                    actionMenu.y,
                    <>
                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                beginGoToTarget( actionMenu.id! );
                            } }
                        >
                            Go to target
                        </button>

                        { hasSelection && (
                            <button
                                disabled={ isCanvasLocked }
                                onClick={ () => {
                                    if ( isCanvasLocked ) return;
                                    onFitSelectionToView();
                                } }
                            >
                                Fit selection to view
                            </button>
                        ) }

                        { renderRigidBlockActions( () => setActionMenu( { open: false, x: 0, y: 0, id: null } ) ) }

                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                handleCreateCondition( actionMenu.id! );
                            } }
                        >
                            Add condition
                        </button>

                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                openActionEditDialog( actionMenu.id! );
                            } }
                        >
                            Edit…
                        </button>

                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                deleteSelected();
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }

            { conditionMenu.open &&
                conditionMenu.id != null &&
                box(
                    conditionMenu.x,
                    conditionMenu.y,
                    <>
                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                retargetCondition( conditionMenu.id! );
                            } }
                        >
                            Go to target
                        </button>

                        { hasSelection && (
                            <button
                                disabled={ isCanvasLocked }
                                onClick={ () => {
                                    if ( isCanvasLocked ) return;
                                    onFitSelectionToView();
                                } }
                            >
                                Fit selection to view
                            </button>
                        ) }
                        { renderRigidBlockActions( () => setConditionMenu( { open: false, x: 0, y: 0, id: null } ) ) }
                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                const c = conditions.find( c0 => c0.id === conditionMenu.id );
                                if ( !c ) return;
                                const t = window.prompt( "Rename condition:", c.title );
                                if ( t != null ) renameCondition( c.id, t );
                            } }
                        >
                            Rename
                        </button>
                        <button
                            disabled={ isCanvasLocked }
                            onClick={ () => {
                                if ( isCanvasLocked ) return;
                                deleteSelected();
                            } }
                        >
                            Delete
                        </button>
                    </>
                ) }
        </>
    );
}
