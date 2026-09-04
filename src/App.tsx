import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { IndiaMap, type StateFeature } from "./components/IndiaMap";
import { Queue } from "./components/Queue";

function App() {
  const [selectedState, setSelectedState] = useState<StateFeature | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const handleSelectState = (state: StateFeature | null) => {
    setSelectedState(state);
    setSelectedDistrict(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-canvas px-md">
        <div className="flex items-center gap-sm">
          <span className="text-sm font-semibold tracking-tight text-ink">
            Averis FRA
          </span>
          <span className="rounded-xs border border-hairline bg-surface-1 px-xs py-px text-xs text-ink-subtle">
            Demo data — synthetic
          </span>
        </div>
        <nav className="hidden items-center gap-xs text-sm text-ink-subtle sm:flex">
          <span className="px-xs">Monitor</span>
          <span className="px-xs">Investigate</span>
          <span className="px-xs">Queue</span>
        </nav>
      </header>

      <main className="flex-1 p-md lg:p-lg">
        <div className="grid min-h-[calc(100vh-3.5rem-2rem)] grid-cols-1 gap-md lg:grid-cols-[1fr_24rem] lg:gap-lg">
          <IndiaMap
            selectedState={selectedState}
            onSelectState={handleSelectState}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={({ district }) => setSelectedDistrict(district)}
          />
          <div className="flex flex-col gap-md lg:gap-lg">
            <Dashboard selectedDistrict={selectedDistrict} />
            <Queue />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
