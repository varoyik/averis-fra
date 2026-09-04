import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import type { Claim, ClaimResult, Factor } from "../lib/types";
import { riskBand } from "../analytics/score";

interface InvestigationProps {
  claim: Claim;
  result: ClaimResult;
  onBack: () => void;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Approximate metres for 0.25° of latitude.
const GRID_CELL_RADIUS_METRES = 27_780;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function rightTypeLabel(type: Claim["rightType"]): string {
  if (type === "HABITAT") return "Habitat";
  return type;
}

function statusLabel(status: Claim["status"]): string {
  switch (status) {
    case "titleIssued":
      return "Title issued";
    case "rejected":
      return "Rejected";
    case "pending":
      return "Pending";
  }
}

function categoryLabel(category: Claim["claimant"]["category"]): string {
  switch (category) {
    case "ST":
      return "Scheduled Tribe";
    case "OTFD":
      return "Other Traditional Forest Dweller";
    case "PVTG":
      return "Particularly Vulnerable Tribal Group";
  }
}

function badgeClasses(band: "normal" | "watch" | "high"): string {
  if (band === "high") return "bg-risk-high/15 text-risk-high";
  if (band === "watch") return "bg-risk-watch/15 text-risk-watch";
  return "bg-risk-low/15 text-risk-low";
}

function SyntheticBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-muted">
      Demo data — synthetic records
    </span>
  );
}

function Panel({
  title,
  phase,
  children,
}: {
  title: string;
  phase?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-md">
      <header className="mb-sm flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        {phase && (
          <span className="text-xs uppercase tracking-wider text-ink-tertiary">
            {phase}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}

function IdentityCard({
  claim,
  result,
}: {
  claim: Claim;
  result: ClaimResult;
}) {
  const band = riskBand(result.riskScore);

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-ink-tertiary">
              Claim investigation
            </span>
            <SyntheticBadge />
          </div>
          <h1 className="mt-1 text-lg font-medium text-ink">
            {claim.claimant.name}
          </h1>
          <p className="text-sm text-ink-subtle">
            {claim.location.village}, {claim.location.tehsil} tehsil,{" "}
            {claim.location.district}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-xs px-xs py-px text-xs font-medium ${badgeClasses(
              band,
            )}`}
          >
            {(result.riskScore * 100).toFixed(0)}% risk
          </span>
          <span className="rounded-xs border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-muted">
            {statusLabel(claim.status)}
          </span>
        </div>
      </div>

      <div className="mt-md grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Claim ID
          </div>
          <div className="mt-0.5 font-mono text-sm text-ink">
            {claim.claimId}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Father&apos;s name
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {claim.claimant.fatherName}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Category
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {categoryLabel(claim.claimant.category)}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Right type
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {rightTypeLabel(claim.rightType)}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            District
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {claim.location.district}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Tehsil
          </div>
          <div className="mt-0.5 text-sm text-ink">{claim.location.tehsil}</div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Village
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {claim.location.village}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Receipt date
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {formatDate(claim.receiptDate)}
          </div>
        </div>
      </div>
    </div>
  );
}

const TIMELINE_STAGES: Array<{
  key: keyof Claim["stages"];
  label: string;
}> = [
  { key: "gsResolution", label: "Gram Sabha / FRC" },
  { key: "sdlcForward", label: "SDLC forwards claim" },
  { key: "sdlcDecision", label: "SDLC decision" },
  { key: "dlcDecision", label: "DLC decision" },
  { key: "titleIssued", label: "Title issued" },
];

function flaggedStageKeys(factors: Factor[]): Array<keyof Claim["stages"]> {
  const keys: Array<keyof Claim["stages"]> = [];
  for (const factor of factors) {
    if (factor.key !== "processing") continue;
    const label = factor.label.toLowerCase();
    if (label.includes("dlc → title")) keys.push("titleIssued");
    else if (label.includes("dlc processing")) keys.push("dlcDecision");
    else if (label.includes("sdlc processing")) keys.push("sdlcDecision");
    else if (label.includes("gram sabha")) keys.push("sdlcForward");
  }
  return keys;
}

function ProcessTimeline({
  claim,
  factors,
}: {
  claim: Claim;
  factors: Factor[];
}) {
  const flagged = useMemo(() => new Set(flaggedStageKeys(factors)), [factors]);

  return (
    <Panel title="Process timeline" phase="Per-stage durations">
      <div className="relative pl-4">
        <div className="absolute bottom-2 left-[0.6875rem] top-2 w-px bg-hairline-strong" />
        <ul className="space-y-sm">
          {TIMELINE_STAGES.map((stage, index) => {
            const date = claim.stages[stage.key];
            const nextStage = TIMELINE_STAGES[index + 1];
            const nextDate = nextStage
              ? claim.stages[nextStage.key]
              : undefined;
            const duration =
              date && nextDate ? daysBetween(date, nextDate) : null;
            const isFlagged = flagged.has(stage.key);
            const reached = Boolean(date);

            return (
              <li
                key={stage.key}
                className={`relative flex items-start justify-between gap-3 rounded-md border p-sm ${
                  isFlagged
                    ? "border-hairline-strong bg-surface-2"
                    : "border-hairline bg-surface-2/50"
                }`}
              >
                <span
                  className={`absolute -left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 ${
                    isFlagged
                      ? "border-risk-high bg-risk-high"
                      : reached
                        ? "border-ink-subtle bg-surface-1"
                        : "border-hairline-strong bg-surface-3"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-ink">
                    {stage.label}
                  </div>
                  {date ? (
                    <div className="mt-0.5 font-mono text-xs text-ink-muted">
                      {formatDate(date)}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-ink-tertiary">
                      Not reached
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {duration !== null ? (
                    <div className="font-mono text-xs text-ink-muted">
                      {duration}d
                    </div>
                  ) : reached ? (
                    <div className="font-mono text-xs text-ink-tertiary">—</div>
                  ) : null}
                  {isFlagged && (
                    <div className="mt-1 text-xs font-medium text-risk-high">
                      Flagged
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function RecordComparison({ claim }: { claim: Claim }) {
  const claimed = claim.land.areaClaimedHa;
  const recorded = claim.land.areaInRecordHa;
  const delta = recorded > 0 ? Math.abs(claimed - recorded) / recorded : 0;
  const overThreshold = delta > 0.3;

  return (
    <Panel title="Record comparison" phase="Claimed vs official record">
      <div className="grid grid-cols-2 gap-sm">
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Area claimed
          </div>
          <div className="mt-1 font-mono text-lg text-ink">
            {claimed.toFixed(2)} ha
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="text-xs uppercase tracking-wider text-ink-tertiary">
            Area in record
          </div>
          <div className="mt-1 font-mono text-lg text-ink">
            {recorded.toFixed(2)} ha
          </div>
        </div>
      </div>

      <div
        className={`mt-sm rounded-md border p-sm ${
          overThreshold
            ? "border-risk-high/30 bg-risk-high/10"
            : "border-hairline bg-surface-2"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Difference</span>
          <span
            className={`font-mono text-sm font-medium ${
              overThreshold ? "text-risk-high" : "text-ink"
            }`}
          >
            {(delta * 100).toFixed(0)}%
          </span>
        </div>
        {overThreshold && (
          <p className="mt-1 text-xs text-risk-high">
            Exceeds the engine&apos;s 30% land-record mismatch threshold.
          </p>
        )}
      </div>
    </Panel>
  );
}

function ClaimMapInset({ claim }: { claim: Claim }) {
  if (!claim.geo) {
    return (
      <Panel title="Claim location" phase="Geo coordinates unavailable">
        <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-hairline bg-surface-2">
          <p className="text-sm text-ink-subtle">
            No coordinates available for this claim.
          </p>
        </div>
      </Panel>
    );
  }

  const center: L.LatLngExpression = [claim.geo.lat, claim.geo.lon];

  return (
    <Panel
      title="Claim location"
      phase={`${claim.geo.lat.toFixed(4)}, ${claim.geo.lon.toFixed(4)}`}
    >
      <div className="h-56 overflow-hidden rounded-md border border-hairline">
        <MapContainer
          center={center}
          zoom={10}
          zoomControl={false}
          scrollWheelZoom={false}
          className="h-full w-full"
          style={{ background: "#010102" }}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <Circle
            center={center}
            radius={GRID_CELL_RADIUS_METRES}
            pathOptions={{
              color: "#5e6ad2",
              weight: 1,
              fillColor: "#5e6ad2",
              fillOpacity: 0.04,
              dashArray: "4 4",
            }}
          />
          <CircleMarker
            center={center}
            radius={8}
            pathOptions={{
              color: "#5e6ad2",
              weight: 2,
              fillColor: "#5e6ad2",
              fillOpacity: 1,
            }}
          />
        </MapContainer>
      </div>
    </Panel>
  );
}

function WhyFlaggedPanel({ result }: { result: ClaimResult }) {
  const band = riskBand(result.riskScore);

  return (
    <Panel
      title="Why was this flagged?"
      phase={`${result.factors.length} signal${result.factors.length === 1 ? "" : "s"}`}
    >
      <div className="mb-sm flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-ink-tertiary">
          Engine risk score
        </span>
        <span
          className={`rounded-xs px-xs py-px text-xs font-medium ${badgeClasses(
            band,
          )}`}
        >
          {(result.riskScore * 100).toFixed(0)}%
        </span>
      </div>

      {result.factors.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No statistically unusual signals detected for this claim.
        </p>
      ) : (
        <ul className="space-y-sm">
          {result.factors.map((factor, index) => (
            <li
              key={index}
              className="rounded-md border border-hairline bg-surface-2 p-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {factor.label}
                </span>
                <span className="font-mono text-xs text-ink-subtle">
                  {(factor.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 font-mono text-xs leading-relaxed text-ink-muted">
                {factor.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function AiInvestigation({ factors }: { factors: Factor[] }) {
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);

  const runInvestigation = async () => {
    setLoading(true);
    setNarrative(null);

    // Fake async delay to simulate an AI call while the real endpoint is being
    // built in phase 1.6.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // TODO 1.6: replace stub with fetch('/api/investigate', ...)
    const fallback = factors
      .map((f) => `${f.label}: ${f.detail}.`)
      .join("\n\n");
    setNarrative(fallback);
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink">AI investigation</h3>
          <p className="text-xs text-ink-subtle">
            Generate a plain-language narrative from the signals above.
          </p>
        </div>
        <button
          type="button"
          onClick={runInvestigation}
          disabled={loading || factors.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? "Investigating..." : "Run AI investigation"}
        </button>
      </div>

      {narrative && (
        <div className="mt-sm rounded-md border border-hairline bg-surface-2 p-sm">
          <div className="mb-2 text-xs uppercase tracking-wider text-ink-tertiary">
            Template fallback narrative
          </div>
          <div className="space-y-2">
            {narrative.split("\n\n").map((sentence, i) => (
              <p key={i} className="text-sm text-ink-muted">
                {sentence}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Investigation({ claim, result, onBack }: InvestigationProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [claim.claimId]);

  return (
    <div className="flex flex-col gap-md lg:gap-lg">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand-focus"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>
      </div>

      <IdentityCard claim={claim} result={result} />

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2 lg:gap-lg">
        <ProcessTimeline claim={claim} factors={result.factors} />
        <RecordComparison claim={claim} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2 lg:gap-lg">
        <ClaimMapInset claim={claim} />
        <WhyFlaggedPanel result={result} />
      </div>

      <AiInvestigation factors={result.factors} />
    </div>
  );
}
