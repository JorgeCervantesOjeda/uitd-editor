// src/App.tsx
// Composes the canvas with a collapsible, horizontally resizable UITDL editor sidebar.

import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
  type WheelEvent,
} from "react";
import Canvas from "./components/Canvas/Canvas";
import { UITDLTextPanel } from "./components/UITDLTextPanel/UITDLTextPanel";
import { useAppStore } from "./state/store";

const MIN_TEXT_PANEL_WIDTH = 360;
const MAX_TEXT_PANEL_WIDTH = 960;
const DEFAULT_TEXT_PANEL_WIDTH = 640;
const COLLAPSED_TEXT_PANEL_WIDTH = 44;

function isDiagramNodeEventTarget( target: EventTarget | null ): boolean {
  return target instanceof Element && target.closest( "[data-node-id]" ) !== null;
}

function widthOfClampedPanel( width: number ): number {
  const widthOfViewportLimit = Math.max( MIN_TEXT_PANEL_WIDTH, window.innerWidth * 0.75 );
  return Math.min( MAX_TEXT_PANEL_WIDTH, widthOfViewportLimit, Math.max( MIN_TEXT_PANEL_WIDTH, width ) );
}

export default function App() {
  const [ isTextPanelCollapsed, setIsTextPanelCollapsed ] = useState( false );
  const [ widthOfTextPanel, setWidthOfTextPanel ] = useState( DEFAULT_TEXT_PANEL_WIDTH );
  const resizeStartRef = useRef<{ clientX: number; width: number } | null>( null );

  const startTextPanelResize = ( event: PointerEvent<HTMLDivElement> ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture( event.pointerId );
    resizeStartRef.current = { clientX: event.clientX, width: widthOfTextPanel };
  };

  const resizeTextPanel = ( event: PointerEvent<HTMLDivElement> ) => {
    const resizeStart = resizeStartRef.current;
    if ( !resizeStart ) return;
    setWidthOfTextPanel( widthOfClampedPanel( resizeStart.width + event.clientX - resizeStart.clientX ) );
  };

  const stopTextPanelResize = ( event: PointerEvent<HTMLDivElement> ) => {
    if ( !resizeStartRef.current ) return;
    if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
      event.currentTarget.releasePointerCapture( event.pointerId );
    }
    resizeStartRef.current = null;
  };

  const resizeTextPanelWithKeyboard = ( event: KeyboardEvent<HTMLDivElement> ) => {
    if ( event.key !== "ArrowLeft" && event.key !== "ArrowRight" ) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setWidthOfTextPanel( currentWidth => widthOfClampedPanel( currentWidth + direction * 20 ) );
  };

  const blockTargetSelectionPointerInteraction = ( event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement> ) => {
    if ( useAppStore.getState().pendingConnect === null ) return;
    if ( event.type !== "contextmenu" && event.button === 0 && isDiagramNodeEventTarget( event.target ) ) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const blockTargetSelectionClick = ( event: SyntheticEvent<HTMLDivElement> ) => {
    if ( useAppStore.getState().pendingConnect === null || isDiagramNodeEventTarget( event.target ) ) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const blockTargetSelectionWheelInteraction = ( event: WheelEvent<HTMLDivElement> ) => {
    if ( useAppStore.getState().pendingConnect === null ) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const blockTargetSelectionKeyboardInteraction = ( event: KeyboardEvent<HTMLDivElement> ) => {
    if ( useAppStore.getState().pendingConnect === null || event.key === "Escape" ) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="appRoot"
      data-target-selection-pending={ useAppStore.getState().pendingConnect !== null || undefined }
      onPointerDownCapture={ blockTargetSelectionPointerInteraction }
      onMouseDownCapture={ blockTargetSelectionPointerInteraction }
      onContextMenuCapture={ blockTargetSelectionPointerInteraction }
      onClickCapture={ blockTargetSelectionClick }
      onDoubleClickCapture={ blockTargetSelectionClick }
      onWheelCapture={ blockTargetSelectionWheelInteraction }
      onKeyDownCapture={ blockTargetSelectionKeyboardInteraction }
    >
      <div
        className={ `uitdlSidebar${isTextPanelCollapsed ? " is-collapsed" : ""}` }
        style={ { width: isTextPanelCollapsed ? COLLAPSED_TEXT_PANEL_WIDTH : widthOfTextPanel } }
      >
        <UITDLTextPanel onCollapse={ () => setIsTextPanelCollapsed( true ) } />
        <button
          type="button"
          className="uitdlSidebar__expand"
          onClick={ () => setIsTextPanelCollapsed( false ) }
          aria-label="Expand UITDL text editor"
          aria-expanded={ !isTextPanelCollapsed }
        >
          <span aria-hidden="true">›</span>
          <span className="uitdlSidebar__expandText">UITDL</span>
        </button>
        { !isTextPanelCollapsed && (
          <div
            className="uitdlSidebar__resizeHandle"
            role="separator"
            aria-label="Resize UITDL text editor"
            aria-orientation="vertical"
            aria-valuemin={ MIN_TEXT_PANEL_WIDTH }
            aria-valuemax={ MAX_TEXT_PANEL_WIDTH }
            aria-valuenow={ Math.round( widthOfTextPanel ) }
            tabIndex={ 0 }
            onPointerDown={ startTextPanelResize }
            onPointerMove={ resizeTextPanel }
            onPointerUp={ stopTextPanelResize }
            onPointerCancel={ stopTextPanelResize }
            onKeyDown={ resizeTextPanelWithKeyboard }
          />
        ) }
      </div>
      <div className="appWorkspace">
        <Canvas />
      </div>
    </div>
  );
}

