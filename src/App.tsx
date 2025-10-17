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
        backgroundImage: "linear-gradient(rgba(255,255,255,0.98), rgba(255,255,255,0.98)), url('/uitd-line-outline.svg')",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundSize: "cover",
      } }
    >
      {/* Main workspace */ }
      <div style={ { position: "relative", flex: 1, minHeight: 0 } }>
        <Canvas />
      </div>
    </div>
  );
}
