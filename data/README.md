# data/

All committed JSON files — this is the app's database (no backend, no runtime fetching). Read-only at runtime; regenerated only by the Phase 0/1 scripts.

## `states.geojson`

- Source: [datameet/maps](https://github.com/datameet/maps) `States/Admin2.shp`, converted + simplified with `mapshaper`.
- 36 features: 28 states + 8 UTs, **post-2019 boundaries** (Telangana & Ladakh separate; D&NH + Daman & Diu merged into one UT).
- Properties: `ST_NM` (display name), `id` (name slug, e.g. `arunachal-pradesh`).
- **Keying: `id` (slug) or `ST_NM`.** There is **no state census code** — `Admin2.shp` does not ship one, and 2011 census codes don't apply to Telangana / Ladakh / the merged UT. Never invent state census codes.

## `districts.geojson`

- Source: [datameet/maps](https://github.com/datameet/maps) `Districts/Census_2011/2011_Dist.shp`, converted + simplified with `mapshaper`.
- 641 features, **Census 2011 boundaries** (Telangana districts still inside Andhra Pradesh; Ladakh districts inside Jammu & Kashmir).
- Properties: `ST_CEN_CD` (state census code), `DT_CEN_CD` (district census code), `ST_NM` (state name), `DISTRICT` (district name), `id` (5-digit census code = `ST_CEN_CD` padded to 2 + `DT_CEN_CD` padded to 3, e.g. Adilabad → `28001`).
- **Keying: `id` (or `ST_CEN_CD` + `DT_CEN_CD`). Never join on `DISTRICT` names** — they repeat across states (e.g. Aurangabad).
- `ST_NM` spelling variants between the two layers (districts are 2011-era): `Arunanchal Pradesh` (sic), `NCT of Delhi` (states: `Delhi`), `Dadara & Nagar Havelli`, `Daman & Diu` (states: merged `Dadra and Nagar Haveli and Daman and Diu`), `Andaman & Nicobar Island` (states: `Andaman & Nicobar`). Cross-layer name joins need an alias map.
- The authoritative district list is this file. Extract it with:
  ```bash
  node -e 'const d=require("./districts.geojson"); d.features.forEach(f=>console.log(f.properties.id, f.properties.ST_NM, "—", f.properties.DISTRICT))'
  ```

## `state-stats.json`

- Real official **state-level** FRA figures (Ministry of Tribal Affairs, as of 30.06.2026). Source: Lok Sabha answer, 23 Jul 2026 — see the `source` block inside the file.
- `national` = national totals; `states` = the 12 states listed in the source. The national total is **not** the sum of these 12 — the source table lists only these 12 states.
- Keyed by `name` (matches `states.geojson` `ST_NM`) and `id` (slug).
- **District-level numbers do not exist officially** — district and claim data is synthetic (below), and must be labelled as demo data wherever shown.

## `generated/claims.json` (task 1.1 — teammate)

Synthetic claims, clearly labelled demo data. Output field names must match the `Claim` type exactly. See ROADMAP §1.1.

### Claim schema

```json
{
  "claimId": "string",
  "receiptDate": "ISO date",
  "status": "pending | rejected | titleIssued",
  "claimant": {
    "name": "string",
    "fatherName": "string",
    "category": "ST | OTFD | PVTG"
  },
  "location": {
    "state": "string",
    "district": "string",
    "tehsil": "string",
    "gramPanchayat": "string",
    "village": "string"
  },
  "land": {
    "khasraNo": "string",
    "plotNo?": "string",
    "forestRange": "string",
    "areaClaimedHa": "number",
    "areaInRecordHa": "number"
  },
  "rightType": "IFR | CFR | CFRR | HABITAT",
  "occupancySince": "ISO date",
  "stages": {
    "gsResolution?": "ISO date",
    "sdlcForward?": "ISO date",
    "sdlcDecision?": "ISO date",
    "dlcDecision?": "ISO date",
    "titleIssued?": "ISO date"
  },
  "evidenceCount": "number"
}
```

- `location.district` must be an exact `DISTRICT` name from `districts.geojson`, and claims should be joined back by the district `id`, never by name alone.
- Right types are exactly `IFR`, `CFR`, `CFRR`, `HABITAT` (no "CLFR").
- Data is designed around the 5 scenarios A–E (processing bottleneck, land mismatch, duplicate-like, spatial cluster, multi-signal hero) — see ROADMAP §1.1.

## Attribution

- India administrative boundaries from [datameet/maps](https://github.com/datameet/maps) by the [DataMeet India community](http://datameet.org/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Note: the repo-root `LICENSE` is MIT and `Districts/README.md` lists CC BY 2.5 India, while the repo-wide README states CC BY 4.0 — attributed here per the repo README.
- State FRA figures: Lok Sabha answer, 23 Jul 2026 — URL in `state-stats.json` `source`.
- Map tiles: © OpenStreetMap contributors.
