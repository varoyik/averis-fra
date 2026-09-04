interface DashboardProps {
  selectedDistrict: string | null;
}

export function Dashboard({ selectedDistrict }: DashboardProps) {
  return (
    <section className="flex min-h-[12rem] flex-1 flex-col rounded-lg border border-hairline bg-surface-1 p-md">
      <header className="mb-sm flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">
          {selectedDistrict ? selectedDistrict : "District dashboard"}
        </h2>
        <span className="text-xs uppercase tracking-wider text-ink-tertiary">
          Phase 1.4
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-hairline bg-canvas">
        <p className="text-sm text-ink-subtle">
          {selectedDistrict
            ? `${selectedDistrict} selected`
            : "KPIs, anomaly callouts, and trend charts"}
        </p>
      </div>
    </section>
  );
}
