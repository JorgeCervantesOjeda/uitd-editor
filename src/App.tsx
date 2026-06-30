// src/App.tsx
import { useState } from "react";
import Canvas from "./components/Canvas/Canvas";
import { UITDLTextPanel } from "./components/UITDLTextPanel/UITDLTextPanel";

export default function App() {
  const [ isTextPanelOpen, setIsTextPanelOpen ] = useState( false );

  return (
    <div className="appRoot">
      { isTextPanelOpen && <UITDLTextPanel onClose={ () => setIsTextPanelOpen( false ) } /> }
      <div className="appWorkspace">
        <Canvas />
        { !isTextPanelOpen && (
          <button
            type="button"
            className="openTextEditorButton"
            onClick={ () => setIsTextPanelOpen( true ) }
          >
            Edit UITDL text
          </button>
        ) }
      </div>
    </div>
  );
}

