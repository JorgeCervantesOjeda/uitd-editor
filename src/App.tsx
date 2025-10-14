import Canvas from "./components/Canvas";

function App() {
  return (
    <div className="app" style={ { display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" } }>
      <header style={ { padding: "8px 12px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" } }>
        <h1 style={ { margin: 0, fontSize: 18 } }>UITD Editor (mínimo)</h1>
      </header>
      <main style={ { position: "relative" } }>
        <Canvas />
      </main>
    </div>
  );
}

export default App;
