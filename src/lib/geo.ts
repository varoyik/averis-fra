// src/lib/geo.ts
// ─────────────────────────────────────────────────────────────
// State-name resolution between the two geo datasets.
//
// states.geojson uses post-2019 ST_NM names (36 units), while
// districts.geojson uses Census 2011 ST_NM names (35 units).
// Claims carry the census spelling (location.state). These
// helpers translate map names → census names so district and
// claim lookups never miss on renamed/split states.
// ─────────────────────────────────────────────────────────────

// states.geojson ST_NM → matching census (districts.geojson) ST_NM name(s).
export const STATE_ALIAS: Record<string, string[]> = {
  Telangana: ["Andhra Pradesh"],
  Ladakh: ["Jammu & Kashmir"],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Dadara & Nagar Havelli",
    "Daman & Diu",
  ],
  "Arunachal Pradesh": ["Arunanchal Pradesh"],
  Delhi: ["NCT of Delhi"],
  "Andaman & Nicobar": ["Andaman & Nicobar Island"],
};

// Resolve a states.geojson name to the census names belonging to it.
export function censusStatesFor(mapName: string): string[] {
  return STATE_ALIAS[mapName] ?? [mapName];
}

// True if the census state name belongs to the given map state name.
export function isCensusStateOf(mapName: string, censusName: string): boolean {
  return censusStatesFor(mapName).includes(censusName);
}

// Unique composite key for a district, safe across states that share
// district names (e.g. Aurangabad exists in both Maharashtra and Bihar).
export function districtKey(state: string, district: string): string {
  return `${state}::${district}`;
}

export function parseDistrictKey(key: string): {
  state: string;
  district: string;
} {
  const sep = key.indexOf("::");
  return {
    state: key.slice(0, sep),
    district: key.slice(sep + 2),
  };
}
