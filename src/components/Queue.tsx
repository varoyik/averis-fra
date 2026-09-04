import { useMemo, useState } from "react";
import claimsRaw from "../../data/generated/claims.json";
import type { Claim, ClaimResult } from "../lib/types";
import { runEngine, riskColor, riskBand } from "../analytics";

// ── Props ─────────────────────────────────────────────────────
// Person A wires onSelectClaim when Investigation workspace (1.5)
// is ready. Until then, the button is a no-op.
interface QueueProps {
  onSelectClaim?: (claimId: string) => void;
}

// ── How many rows to show per page ────────────────────────────
const PAGE_SIZE = 10;

// ── Right-type badge colours ──────────────────────────────────
const RIGHT_TYPE_COLOR: Record<string, string> = {
  IFR:     "border-blue-500/40   text-blue-400",
  CFR:     "border-emerald-500/40 text-emerald-400",
  CFRR:    "border-violet-500/40  text-violet-400",
  HABITAT: "border-amber-500/40   text-amber-400",
};

export function Queue({ onSelectClaim }: QueueProps = {}) {
  // ── Run engine once and memoise ───────────────────────────────
  const { topClaims, districts, claimMap } = useMemo(() => {
    const claims = claimsRaw as Claim[];
    const output = runEngine(claims);
    const map = new Map(claims.map((c) => [c.claimId, c]));
    return { topClaims: output.topClaims, districts: output.districts, claimMap: map };
  }, []);

  // ── District filter state (Roadmap: rank districts, within hero rank claims)
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");

  // ── Filtered claims based on selected district ─────────────────
  const filteredClaims = useMemo(() => {
    if (selectedDistrict === "all") return topClaims;
    return topClaims.filter(
      (cr) => claimMap.get(cr.claimId)?.location.district === selectedDistrict
    );
  }, [topClaims, claimMap, selectedDistrict]);

  // ── Pagination state ──────────────────────────────────────────
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const visible = filteredClaims.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="flex min-h-[12rem] flex-1 flex-col rounded-lg border border-hairline bg-surface-1 p-md">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="mb-sm flex flex-wrap items-center justify-between gap-xs">
        <div className="flex items-center gap-xs">
          <h2 className="text-sm font-medium text-ink">Priority queue</h2>
          <span className="rounded-pill bg-surface-3 px-xs py-px text-xs tabular-nums text-ink-subtle">
            {filteredClaims.length} flagged
          </span>
        </div>

        {/* District selector: ranks districts by risk score */}
        <select
          aria-label="Filter queue by district"
          value={selectedDistrict}
          onChange={(e) => {
            setSelectedDistrict(e.target.value);
            setPage(0);
          }}
          className="rounded-sm border border-hairline bg-surface-2 px-xs py-0.5 text-xs text-ink focus:border-brand focus:outline-none"
        >
          <option value="all">All districts ({topClaims.length})</option>
          {districts.map((d) => (
            <option key={d.district} value={d.district}>
              {d.district} {d.district === "Dindori" ? "★ " : ""}· {(d.riskScore * 100).toFixed(0)}% risk ({d.anomalyCount})
            </option>
          ))}
        </select>
      </header>

      {/* ── Claim rows ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-xxs overflow-y-auto">
        {visible.map((cr: ClaimResult, idx: number) => {
          const rank = page * PAGE_SIZE + idx + 1;
          const claim = claimMap.get(cr.claimId);
          if (!claim) return null;

          const band = riskBand(cr.riskScore);
          const color = riskColor(cr.riskScore);
          const dominant = cr.factors[0]; // highest-weight factor first

          return (
            <div
              key={cr.claimId}
              className="group flex items-center gap-sm rounded-md border border-hairline bg-canvas px-sm py-xs transition-colors hover:border-hairline-strong hover:bg-surface-2"
            >
              {/* Rank */}
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-tertiary">
                #{rank}
              </span>

              {/* Risk score pill */}
              <span
                className="shrink-0 rounded-pill px-xs py-px text-xs font-semibold tabular-nums"
                title={`Risk band: ${band}`}
                style={{
                  color,
                  backgroundColor: `${color}18`,
                  border: `1px solid ${color}40`,
                }}
              >
                {(cr.riskScore * 100).toFixed(0)}%
              </span>

              {/* Claim info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-xs">
                  <span className="truncate text-sm text-ink">
                    {claim.claimant.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-xs border px-xs py-px text-[10px] font-medium uppercase ${
                      RIGHT_TYPE_COLOR[claim.rightType] ?? "border-hairline text-ink-subtle"
                    }`}
                  >
                    {claim.rightType}
                  </span>
                </div>
                <p className="truncate text-xs text-ink-subtle">
                  {claim.location.village}, {claim.location.district}
                  {" · "}
                  <span className="text-ink-tertiary">{claim.claimId}</span>
                </p>
              </div>

              {/* Dominant reason */}
              {dominant && (
                <p
                  className="hidden shrink-0 text-right text-xs xl:block"
                  style={{ color, maxWidth: "14rem" }}
                >
                  Investigate first — {dominant.label.toLowerCase()}
                </p>
              )}

              {/* Action button */}
              <button
                type="button"
                onClick={() => onSelectClaim?.(cr.claimId)}
                className="shrink-0 rounded-sm border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-subtle transition-colors hover:border-brand hover:text-brand"
                title={`Investigate claim ${cr.claimId}`}
              >
                Investigate →
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <footer className="mt-sm flex items-center justify-between border-t border-hairline pt-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-sm border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-subtle transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink-subtle"
          >
            ← Prev
          </button>
          <span className="text-xs tabular-nums text-ink-tertiary">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-sm border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-subtle transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink-subtle"
          >
            Next →
          </button>
        </footer>
      )}
    </section>
  );
}
