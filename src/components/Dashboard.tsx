import { useMemo } from "react";
import type { StateFeature } from "./IndiaMap";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runEngine } from "../analytics/score";
import claims from "../../data/generated/claims.json";
import stateStats from "../../data/state-stats.json";
import type { Claim } from "../lib/types";

interface DashboardProps {
  selectedState: StateFeature | null;
  selectedDistrict: string | null;
  selectedDistrictState: string | null;
}

const BRAND = "#5e6ad2";
const RISK_LOW = "#27a644";
const RISK_WATCH = "#f5a623";
const RISK_HIGH = "#ef4444";
const GRID = "#23252a";
const TOOLTIP_BG = "#0f1011";
const TOOLTIP_BORDER = "#23252a";

function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatPct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function getLatestStageDate(claim: Claim): Date | null {
  const dates = Object.values(claim.stages).filter((d): d is string =>
    Boolean(d),
  );
  if (dates.length === 0) return null;
  return new Date(dates.sort().at(-1)!);
}

function medianProcessingDays(claims: Claim[]): number | null {
  const days = claims
    .map((c) => {
      const latest = getLatestStageDate(c);
      if (!latest) return null;
      const receipt = new Date(c.receiptDate);
      return Math.round(
        (latest.getTime() - receipt.getTime()) / (1000 * 60 * 60 * 24),
      );
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 === 0
    ? Math.round((days[mid - 1] + days[mid]) / 2)
    : days[mid];
}

function monthlyReceivedTrend(
  claims: Claim[],
): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of claims) {
    const month = c.receiptDate.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));
}

function statusCounts(claims: Claim[]) {
  let titleIssued = 0;
  let rejected = 0;
  let pending = 0;
  for (const c of claims) {
    if (c.status === "titleIssued") titleIssued++;
    else if (c.status === "rejected") rejected++;
    else pending++;
  }
  return {
    received: claims.length,
    titleIssued,
    rejected,
    pending,
    settled: titleIssued + rejected,
  };
}

function badgeClasses(band: "normal" | "watch" | "high"): string {
  if (band === "high") return "bg-risk-high/15 text-risk-high";
  if (band === "watch") return "bg-risk-watch/15 text-risk-watch";
  return "bg-risk-low/15 text-risk-low";
}

function KpiCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-tertiary">
        {label}
      </div>
      <div className="mt-1 text-lg font-medium text-ink">{value}</div>
      {subtext && (
        <div className="mt-0.5 text-xs text-ink-subtle">{subtext}</div>
      )}
    </div>
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
      <header className="mb-sm flex items-center justify-between">
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

const tooltipProps = {
  contentStyle: {
    backgroundColor: TOOLTIP_BG,
    border: `1px solid ${TOOLTIP_BORDER}`,
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#d0d6e0" },
  itemStyle: { color: "#f7f8f8" },
  cursor: { fill: "rgba(255,255,255,0.06)" },
};

function StatusChart({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#d0d6e0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8a8f98", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip {...tooltipProps} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#d0d6e0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: string) => {
              const [year, month] = value.split("-");
              const date = new Date(Number(year), Number(month) - 1);
              return date.toLocaleString("en-IN", {
                month: "short",
                year: "2-digit",
              });
            }}
          />
          <YAxis
            tick={{ fill: "#8a8f98", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip {...tooltipProps} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#trendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SyntheticBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-muted">
      Demo data — synthetic records
    </span>
  );
}

export function Dashboard({
  selectedState,
  selectedDistrict,
  selectedDistrictState,
}: DashboardProps) {
  const engineOutput = useMemo(() => runEngine(claims as Claim[]), []);

  const stateStat = useMemo(() => {
    if (!selectedState) return null;
    return (
      stateStats.states.find((s) => s.id === selectedState.properties.id) ??
      stateStats.states.find(
        (s) => s.name === selectedState.properties.ST_NM,
      ) ??
      null
    );
  }, [selectedState]);

  const districtResult = useMemo(() => {
    if (!selectedDistrict) return null;
    return (
      engineOutput.districts.find((d) => d.district === selectedDistrict) ??
      null
    );
  }, [engineOutput, selectedDistrict]);

  const districtClaims = useMemo(() => {
    if (!selectedDistrict) return [];
    return (claims as Claim[]).filter(
      (c) => c.location.district === selectedDistrict,
    );
  }, [selectedDistrict]);

  // ── District mode ─────────────────────────────────────────────
  if (selectedDistrict && districtResult && districtClaims.length > 0) {
    const counts = statusCounts(districtClaims);
    const medianDays = medianProcessingDays(districtClaims);
    const highRisk = districtResult.claimResults.filter(
      (r) => r.riskScore >= 0.55,
    ).length;
    const statusData = [
      { name: "Received", value: counts.received, fill: BRAND },
      { name: "Titles", value: counts.titleIssued, fill: RISK_LOW },
      { name: "Rejected", value: counts.rejected, fill: RISK_HIGH },
      { name: "Pending", value: counts.pending, fill: RISK_WATCH },
    ];
    const trend = monthlyReceivedTrend(districtClaims);
    const topClaims = districtResult.claimResults
      .filter((r) => r.factors.length > 0)
      .slice(0, 3);

    return (
      <section className="flex flex-col gap-md overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-md lg:max-h-[calc(100vh-3.5rem-4rem)]">
        <header className="flex items-start justify-between gap-sm">
          <div>
            <h2 className="text-sm font-medium text-ink">{selectedDistrict}</h2>
            <p className="text-xs text-ink-subtle">{selectedDistrictState}</p>
          </div>
          <SyntheticBadge />
        </header>

        <div className="grid grid-cols-2 gap-sm">
          <KpiCard label="Received" value={formatCount(counts.received)} />
          <KpiCard label="Settled" value={formatCount(counts.settled)} />
          <KpiCard label="Pending" value={formatCount(counts.pending)} />
          <KpiCard
            label="Approval rate"
            value={formatPct(counts.titleIssued, counts.settled)}
          />
          <KpiCard
            label="Median processing time"
            value={medianDays === null ? "—" : `${medianDays} days`}
            subtext="Based on latest stage reached"
          />
          <KpiCard label="High-risk claims" value={formatCount(highRisk)} />
        </div>

        <Panel title="Status distribution" phase="Received vs outcome">
          <StatusChart data={statusData} />
        </Panel>

        <Panel title="Processing-time trend" phase="Claims received per month">
          <TrendChart data={trend} />
        </Panel>

        <Panel
          title="What's unusual here"
          phase={`${districtResult.anomalyCount} flagged`}
        >
          {districtResult.dominantFactors.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              No statistically unusual patterns detected in this district.
            </p>
          ) : (
            <div className="space-y-md">
              <ul className="space-y-sm">
                {districtResult.dominantFactors.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-hairline bg-surface-2 p-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {f.label}
                      </span>
                      <span className="font-mono text-xs text-ink-subtle">
                        {(f.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{f.detail}</p>
                  </li>
                ))}
              </ul>

              {topClaims.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs uppercase tracking-wider text-ink-tertiary">
                    Top claims to investigate first
                  </div>
                  <ul className="space-y-sm">
                    {topClaims.map((r) => (
                      <li
                        key={r.claimId}
                        className="flex items-start justify-between gap-2 rounded-md border border-hairline bg-surface-2 p-sm"
                      >
                        <div>
                          <div className="font-mono text-xs text-ink">
                            {r.claimId}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-subtle">
                            {r.factors[0]?.label ?? "Multiple signals"}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-xs px-xs py-px text-xs font-medium ${badgeClasses(
                            r.riskScore >= 0.55
                              ? "high"
                              : r.riskScore >= 0.25
                                ? "watch"
                                : "normal",
                          )}`}
                        >
                          {(r.riskScore * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </section>
    );
  }

  // ── State mode ────────────────────────────────────────────────
  if (selectedState) {
    const stat = stateStat;
    const counts = stat
      ? {
          received: stat.claimsReceived,
          titleIssued: stat.titlesGranted,
          rejected: stat.rejected,
          pending: stat.pending,
          settled: stat.titlesGranted + stat.rejected,
        }
      : null;
    const statusData = counts
      ? [
          { name: "Received", value: counts.received, fill: BRAND },
          { name: "Titles", value: counts.titleIssued, fill: RISK_LOW },
          { name: "Rejected", value: counts.rejected, fill: RISK_HIGH },
          { name: "Pending", value: counts.pending, fill: RISK_WATCH },
        ]
      : [];

    const syntheticDistricts = engineOutput.districts.filter(
      (d) => d.state === selectedState.properties.ST_NM,
    );

    return (
      <section className="flex flex-col gap-md overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-md lg:max-h-[calc(100vh-3.5rem-4rem)]">
        <header className="flex items-start justify-between gap-sm">
          <div>
            <h2 className="text-sm font-medium text-ink">
              {selectedState.properties.ST_NM}
            </h2>
            <p className="text-xs text-ink-subtle">
              Official state data · MoTA, 30 Jun 2026
            </p>
          </div>
        </header>

        {counts ? (
          <>
            <div className="grid grid-cols-2 gap-sm">
              <KpiCard label="Received" value={formatCount(counts.received)} />
              <KpiCard label="Settled" value={formatCount(counts.settled)} />
              <KpiCard label="Pending" value={formatCount(counts.pending)} />
              <KpiCard
                label="Approval rate"
                value={formatPct(counts.titleIssued, counts.settled)}
              />
              <KpiCard label="Median processing time" value="—" />
              <KpiCard label="High-risk claims" value="—" />
            </div>

            <Panel title="Status distribution" phase="Received vs outcome">
              <StatusChart data={statusData} />
            </Panel>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-hairline bg-canvas p-md text-center">
            <p className="text-sm text-ink-subtle">
              No official figures available for this state.
            </p>
          </div>
        )}

        <Panel title="What's unusual here" phase="District-level signals">
          {syntheticDistricts.length > 0 ? (
            <ul className="space-y-sm">
              {syntheticDistricts.map((d) => (
                <li
                  key={d.district}
                  className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface-2 p-sm"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {d.district}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {d.anomalyCount} flagged · {d.totalClaims} claims
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-xs px-xs py-px text-xs font-medium ${badgeClasses(
                      d.riskScore >= 0.55
                        ? "high"
                        : d.riskScore >= 0.25
                          ? "watch"
                          : "normal",
                    )}`}
                  >
                    {(d.riskScore * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-subtle">
                District-level anomaly data is available for Madhya Pradesh —
                select it to drill down.
              </p>
              <SyntheticBadge />
            </div>
          )}
        </Panel>
      </section>
    );
  }

  // ── National mode ─────────────────────────────────────────────
  const national = stateStats.national;
  const nationalCounts = {
    received: national.claimsReceived,
    titleIssued: national.titlesGranted,
    rejected: national.rejected,
    pending: national.pending,
    settled: national.titlesGranted + national.rejected,
  };
  const nationalStatusData = [
    { name: "Received", value: nationalCounts.received, fill: BRAND },
    { name: "Titles", value: nationalCounts.titleIssued, fill: RISK_LOW },
    { name: "Rejected", value: nationalCounts.rejected, fill: RISK_HIGH },
    { name: "Pending", value: nationalCounts.pending, fill: RISK_WATCH },
  ];
  const topDistricts = engineOutput.districts.slice(0, 6);

  return (
    <section className="flex flex-col gap-md overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-md lg:max-h-[calc(100vh-3.5rem-4rem)]">
      <header className="flex items-start justify-between gap-sm">
        <div>
          <h2 className="text-sm font-medium text-ink">National overview</h2>
          <p className="text-xs text-ink-subtle">
            Official — MoTA, 30 Jun 2026
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-sm">
        <KpiCard
          label="Received"
          value={formatCount(nationalCounts.received)}
        />
        <KpiCard label="Settled" value={formatCount(nationalCounts.settled)} />
        <KpiCard label="Pending" value={formatCount(nationalCounts.pending)} />
        <KpiCard
          label="Approval rate"
          value={formatPct(nationalCounts.titleIssued, nationalCounts.settled)}
        />
        <KpiCard label="Median processing time" value="—" />
        <KpiCard label="High-risk claims" value="—" />
      </div>

      <Panel title="Status distribution" phase="Received vs outcome">
        <StatusChart data={nationalStatusData} />
      </Panel>

      <Panel title="What's unusual here" phase="Top flagged districts">
        <ul className="space-y-sm">
          {topDistricts.map((d) => (
            <li
              key={d.district}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface-2 p-sm"
            >
              <div>
                <div className="text-sm font-medium text-ink">{d.district}</div>
                <div className="text-xs text-ink-subtle">
                  {d.anomalyCount} flagged · {d.totalClaims} claims
                </div>
              </div>
              <span
                className={`shrink-0 rounded-xs px-xs py-px text-xs font-medium ${badgeClasses(
                  d.riskScore >= 0.55
                    ? "high"
                    : d.riskScore >= 0.25
                      ? "watch"
                      : "normal",
                )}`}
              >
                {(d.riskScore * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
