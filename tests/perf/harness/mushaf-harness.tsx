import React, { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { MushafRuntime } from "../../../src/mushaf-engine/runtime/MushafRuntime";
import { MushafScrollView } from "../../../src/mushaf-engine/components/MushafScrollView";

function App() {
  const runtime = useMemo(() => new MushafRuntime("v2"), []);

  useEffect(() => {
    return () => runtime.dispose();
  }, [runtime]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 8, fontFamily: "system-ui, sans-serif", fontSize: 12 }}>
        Perf harness (portless)
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MushafScrollView
          mushafCode="v2"
          startPage={1}
          endPage={50}
          runtime={runtime}
          onVerseSelect={() => {}}
          showDebug={false}
        />
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

createRoot(rootEl).render(<App />);

