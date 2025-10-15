// src/App.tsx
import Canvas from "./components/Canvas/Canvas";

export default function App() {
  return (
    <div
      style={ {
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      } }
    >
      {/* Main workspace */ }
      <div style={ { position: "relative", flex: 1, minHeight: 0 } }>
        <Canvas />
      </div>
    </div>
  );
}
