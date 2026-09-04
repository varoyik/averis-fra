import { useMemo, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { IndiaMap, type StateFeature } from "./components/IndiaMap";
import { Investigation } from "./components/Investigation";
import { Queue } from "./components/Queue";
import { runEngine } from "./analytics/score";
import claims from "../data/generated/claims.json";
import type { Claim } from "./lib/types";

function App() {
  const [selectedState, setSelectedState] = useState<StateFeature | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedDistrictState, setSelectedDistrictState] = useState<
    string | null
  >(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const engineOutput = useMemo(() => runEngine(claims as Claim[]), []);

  const selectedClaim = useMemo(() => {
    if (!selectedClaimId) return null;
    return (
      (claims as Claim[]).find((c) => c.claimId === selectedClaimId) ?? null
    );
  }, [selectedClaimId]);

  const selectedResult = useMemo(() => {
    if (!selectedClaim) return null;
    return (
      engineOutput.topClaims.find((r) => r.claimId === selectedClaim.claimId) ??
      null
    );
  }, [selectedClaim, engineOutput]);

  const handleSelectState = (state: StateFeature | null) => {
    setSelectedState(state);
    setSelectedDistrict(null);
    setSelectedDistrictState(null);
  };

  const handleSelectDistrict = (payload: {
    district: string;
    state: string;
  }) => {
    setSelectedDistrict(payload.district);
    setSelectedDistrictState(payload.state);
  };

  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
  };

  const handleBack = () => {
    setSelectedClaimId(null);
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
        {selectedClaim && selectedResult ? (
          <Investigation
            claim={selectedClaim}
            result={selectedResult}
            onBack={handleBack}
          />
        ) : (
          <div className="grid min-h-[calc(100vh-3.5rem-2rem)] grid-cols-1 gap-md lg:grid-cols-[1fr_24rem] lg:gap-lg">
            <IndiaMap
              selectedState={selectedState}
              onSelectState={handleSelectState}
              selectedDistrict={selectedDistrict}
              onSelectDistrict={handleSelectDistrict}
            />
            <div className="flex flex-col gap-md lg:gap-lg">
              <Dashboard
                selectedState={selectedState}
                selectedDistrict={selectedDistrict}
                selectedDistrictState={selectedDistrictState}
                onSelectClaim={handleSelectClaim}
              />
              <Queue onSelectClaim={handleSelectClaim} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
