export function IndiaMap() {
  return (
    <section className="relative flex min-h-[20rem] flex-col overflow-hidden rounded-xl border border-hairline-strong bg-inverse-canvas lg:min-h-0">
      <div className="absolute left-sm top-sm z-10">
        <span className="inline-flex items-center rounded-md border border-hairline-strong bg-inverse-surface-1 px-xs py-px text-xs text-inverse-ink">
          Map area
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-medium tracking-tight text-inverse-ink">
            India map
          </p>
          <p className="mt-xs text-sm text-ink-subtle">
            Phase 1.3 · choropleth + drill-down
          </p>
        </div>
      </div>

      <div className="absolute bottom-sm right-sm">
        <span className="text-xs text-inverse-ink/60">
          Offline fallback: plain background
        </span>
      </div>
    </section>
  );
}
