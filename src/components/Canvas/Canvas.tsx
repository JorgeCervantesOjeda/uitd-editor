// src/components/Canvas/Canvas.tsx
import { useRef } from "react";
import { useAppStore } from "../../state/store";
import { EdgesLayer } from "./edges";
import { NodesLayer } from "./nodes";
import { ActionsLayer } from "./actions";
import { useCoordHelpers } from "./coord";
import { useBackgroundInteraction } from "./background";
import { useCombinedDragging } from "./dragging";
import { useContextMenus } from "./contextmenus";
import { useKeyboardShortcuts } from "./keyboard";
import { renderMenus } from "./renderMenus";
import { MenuBusProvider } from "./menuBus";

export default function Canvas() {
    const hostRef = useRef<HTMLDivElement | null>( null );
    const svgRef = useRef<SVGSVGElement | null>( null );
    const gRef = useRef<SVGGElement | null>( null );

    const panzoom = useAppStore( ( s ) => s.panzoom );
    const viewBox = useAppStore( ( s ) => s.viewBox );

    const {
        canvasMenu, nodeMenu, actionMenu, conditionMenu,
        setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu,
        setAllClosed, onContextMenuHost,
        createNodeFromCanvasMenu,
    } = useContextMenus();

    const { clientToGroupPoint } = useCoordHelpers( svgRef, gRef );

    const { onMouseDownBackground, onWheel, endPanDrag } = useBackgroundInteraction( {
        svgRef,
        clientToGroupPoint,
        setCanvasMenu, setNodeMenu, setActionMenu, setAllClosed
    } );

    const { onMouseMoveCombined, endCombined } = useCombinedDragging( { clientToGroupPoint } );

    useKeyboardShortcuts( { setCanvasMenu, setNodeMenu, setActionMenu } );

    const menuBusValue = {
        openNodeMenu: ( x: number, y: number, nodeId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setActionMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: false, x: 0, y: 0, id: null } );
            setNodeMenu( { open: true, x, y, id: nodeId } );
        },
        openActionMenu: ( x: number, y: number, actionId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setNodeMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: false, x: 0, y: 0, id: null } );
            setActionMenu( { open: true, x, y, id: actionId } );
        },
        openConditionMenu: ( x: number, y: number, conditionId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setNodeMenu( { open: false, x: 0, y: 0, id: null } );
            setActionMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: true, x, y, id: conditionId } );
        },
        closeAll: () => setAllClosed(),
    };

    return (
        <div
            ref={ hostRef }
            style={ { position: "absolute", inset: 0, background: "#fff", cursor: "grab" } }
            onContextMenu={ ( e ) => e.preventDefault() }
            className="canvas"
        >
            <MenuBusProvider value={ menuBusValue }>
                <svg
                    ref={ svgRef }
                    width="100%"
                    height="100%"
                    viewBox={ `0 0 ${viewBox.w} ${viewBox.h}` }
                    preserveAspectRatio="xMidYMid meet"
                    onMouseDown={ onMouseDownBackground }
                    onMouseMove={ onMouseMoveCombined }
                    onMouseUp={ () => { endPanDrag(); endCombined(); } }
                    onMouseLeave={ () => { endPanDrag(); endCombined(); } }
                    onWheel={ onWheel }
                    onContextMenu={ onContextMenuHost }
                >
                    <g
                        ref={ gRef }
                        data-root="root"
                        transform={ `translate(${panzoom.x} ${panzoom.y}) scale(${panzoom.zoom})` }
                    >
                        <EdgesLayer />
                        <NodesLayer />
                        <ActionsLayer />
                    </g>
                </svg>

                { renderMenus( {
                    canvasMenu, nodeMenu, actionMenu, conditionMenu,
                    onCreateNode: () => createNodeFromCanvasMenu( canvasMenu.x, canvasMenu.y, clientToGroupPoint ),
                    setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu
                } ) }
            </MenuBusProvider>
        </div>
    );
}
