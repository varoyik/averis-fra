"""
validate_data.py
────────────────
Schema, chronology, and scenario validator for data/generated/claims.json.

Run:   python scripts/py/validate_data.py
Exit:  0 = all checks pass · 1 = one or more checks failed

Checks:
  1. Schema      — required fields, correct types, allowed enum values
  2. Uniqueness  — all claimIds unique
  3. Chronology  — stages in order, dates in valid range
  4. Status      — consistency with stage presence
  5. Scenarios   — A B C D E all demonstrably present
  6. Sanity      — claim count, district count, area bounds
"""

import io
import json
import math
import os
import re
import sys
from datetime import date

# Force UTF-8 stdout on Windows (avoids cp1252 encoding errors)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ── Config ────────────────────────────────────────────────────────────────────
DATA_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "generated", "claims.json"
)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

REQUIRED_TOP = ["claimId", "receiptDate", "status", "claimant", "location",
                "land", "rightType", "occupancySince", "stages", "evidenceCount", "geo"]
REQUIRED_CLAIMANT  = ["name", "fatherName", "category"]
REQUIRED_LOCATION  = ["state", "district", "tehsil", "gramPanchayat", "village"]
REQUIRED_LAND      = ["khasraNo", "forestRange", "areaClaimedHa", "areaInRecordHa"]
REQUIRED_STAGES    = ["gsResolution", "sdlcForward", "sdlcDecision",
                       "dlcDecision", "titleIssued"]
REQUIRED_GEO       = ["lat", "lon"]

VALID_STATUS    = {"pending", "rejected", "titleIssued"}
VALID_CATEGORY  = {"ST", "OTFD", "PVTG"}
VALID_RIGHTTYPE = {"IFR", "CFR", "CFRR", "HABITAT"}

DATE_MIN = date(2005, 1, 1)
DATE_MAX = date(2026, 12, 31)
HERO_ID  = "MP-DIN-HERO-001"


# ── Result collector ──────────────────────────────────────────────────────────
class Results:
    def __init__(self):
        self.rows = []   # (label, passed, detail)

    def check(self, label: str, passed: bool, detail: str = ""):
        self.rows.append((label, passed, detail))

    def print_summary(self):
        width = max(len(r[0]) for r in self.rows) + 2
        sep = "-" * (width + 30)
        print("\n" + sep)
        print(f"{'Check':<{width}}  {'Result':<8}  Detail")
        print(sep)
        for label, passed, detail in self.rows:
            icon = "[PASS]" if passed else "[FAIL]"
            print(f"{label:<{width}}  {icon:<8}  {detail}")
        print(sep)

    def all_pass(self) -> bool:
        return all(r[1] for r in self.rows)


# ── Helpers ───────────────────────────────────────────────────────────────────
def is_date(s) -> bool:
    if not isinstance(s, str) or not DATE_RE.match(s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False

def parse_date(s) -> date:
    return date.fromisoformat(s)

def stage_order(stages: dict) -> list[date]:
    """Return a list of (key, date) for present stages in canonical order."""
    order = ["gsResolution", "sdlcForward", "sdlcDecision", "dlcDecision", "titleIssued"]
    return [(k, parse_date(stages[k])) for k in order if k in stages]

def grid_cell(lat: float, lon: float) -> str:
    return f"{math.floor(lat / 0.25)}:{math.floor(lon / 0.25)}"


# ── Validation logic ──────────────────────────────────────────────────────────
def validate(claims: list, res: Results):

    # ── 1. Schema ──────────────────────────────────────────────────────────────
    schema_errors = 0
    for i, c in enumerate(claims):
        cid = c.get("claimId", f"[index {i}]")

        for field in REQUIRED_TOP:
            if field not in c:
                schema_errors += 1

        if "claimant" in c:
            for f in REQUIRED_CLAIMANT:
                if f not in c["claimant"]:
                    schema_errors += 1

        if "location" in c:
            for f in REQUIRED_LOCATION:
                if f not in c["location"]:
                    schema_errors += 1

        if "land" in c:
            for f in REQUIRED_LAND:
                if f not in c["land"]:
                    schema_errors += 1
            land = c["land"]
            if "areaClaimedHa" in land and not isinstance(land["areaClaimedHa"], (int, float)):
                schema_errors += 1
            if "areaInRecordHa" in land and not isinstance(land["areaInRecordHa"], (int, float)):
                schema_errors += 1

        if "geo" in c:
            for f in REQUIRED_GEO:
                if f not in c["geo"]:
                    schema_errors += 1

        if c.get("status") not in VALID_STATUS:
            schema_errors += 1
        if c.get("rightType") not in VALID_RIGHTTYPE:
            schema_errors += 1
        if c.get("claimant", {}).get("category") not in VALID_CATEGORY:
            schema_errors += 1
        if not is_date(c.get("receiptDate", "")):
            schema_errors += 1
        if not is_date(c.get("occupancySince", "")):
            schema_errors += 1

        for v in c.get("stages", {}).values():
            if not is_date(v):
                schema_errors += 1

        if not isinstance(c.get("evidenceCount"), int):
            schema_errors += 1

    res.check(
        "1. Schema fields & types",
        schema_errors == 0,
        f"{schema_errors} error(s) across {len(claims)} claims",
    )

    # ── 2. Uniqueness ─────────────────────────────────────────────────────────
    ids = [c.get("claimId") for c in claims]
    dupes = len(ids) - len(set(ids))
    res.check("2. Unique claimIds", dupes == 0, f"{dupes} duplicate(s)")

    # ── 3. Enums ──────────────────────────────────────────────────────────────
    bad_status = sum(1 for c in claims if c.get("status") not in VALID_STATUS)
    res.check("3a. status enum", bad_status == 0, f"{bad_status} bad value(s)")

    bad_rt = sum(1 for c in claims if c.get("rightType") not in VALID_RIGHTTYPE)
    res.check("3b. rightType enum", bad_rt == 0, f"{bad_rt} bad value(s)")

    bad_cat = sum(1 for c in claims if c.get("claimant", {}).get("category") not in VALID_CATEGORY)
    res.check("3c. category enum", bad_cat == 0, f"{bad_cat} bad value(s)")

    # ── 4. Chronological stages ───────────────────────────────────────────────
    chron_errors = 0
    status_errors = 0
    date_range_errors = 0

    for c in claims:
        receipt = parse_date(c["receiptDate"]) if is_date(c.get("receiptDate", "")) else None
        occupancy = parse_date(c["occupancySince"]) if is_date(c.get("occupancySince", "")) else None

        if receipt and occupancy and receipt <= occupancy:
            chron_errors += 1

        stages = c.get("stages", {})
        ordered = stage_order(stages)

        # Check sequential order
        for j in range(1, len(ordered)):
            if ordered[j][1] < ordered[j-1][1]:
                chron_errors += 1

        # Check no stage before receipt
        if receipt:
            for _, d in ordered:
                if d < receipt:
                    chron_errors += 1

        # Date range check
        for _, d in ordered:
            if not (DATE_MIN <= d <= DATE_MAX):
                date_range_errors += 1
        if receipt and not (DATE_MIN <= receipt <= DATE_MAX):
            date_range_errors += 1

        # Status consistency
        if c.get("status") == "titleIssued" and "titleIssued" not in stages:
            status_errors += 1

    res.check("4a. Stage chronological order", chron_errors == 0,
              f"{chron_errors} violation(s)")
    res.check("4b. Status ↔ stage consistency", status_errors == 0,
              f"{status_errors} inconsistency(ies)")
    res.check("4c. Dates in valid range", date_range_errors == 0,
              f"{date_range_errors} out-of-range date(s)")

    # ── 5. Scenario A — processing bottleneck ────────────────────────────────
    # ≥10 claims in one district with DLC stage > 300 days
    bottleneck_by_district: dict = {}
    for c in claims:
        stages = c.get("stages", {})
        if "sdlcDecision" in stages and "dlcDecision" in stages:
            duration = (parse_date(stages["dlcDecision"])
                        - parse_date(stages["sdlcDecision"])).days
            if duration > 300:
                dist = c["location"]["district"]
                bottleneck_by_district[dist] = bottleneck_by_district.get(dist, 0) + 1

    max_bottleneck = max(bottleneck_by_district.values(), default=0)
    res.check("5A. Bottleneck district (≥10 DLC>300d claims)",
              max_bottleneck >= 10,
              f"Max in one district: {max_bottleneck}")

    # ── 5. Scenario B — area mismatch ─────────────────────────────────────────
    mismatch_count = 0
    for c in claims:
        land = c.get("land", {})
        claimed = land.get("areaClaimedHa", 0)
        record  = land.get("areaInRecordHa", 0)
        if record > 0 and abs(claimed - record) / record > 0.30:
            mismatch_count += 1

    res.check("5B. Area mismatch >30% (≥15 claims)",
              mismatch_count >= 15,
              f"Found: {mismatch_count}")

    # ── 5. Scenario C — duplicate pairs ───────────────────────────────────────
    # Blocking key: (village, khasraNo) — ≥5 groups with ≥2 claims
    from collections import Counter
    block_keys = [
        (c["location"]["village"].lower().strip(),
         c["land"]["khasraNo"].strip())
        for c in claims
        if "village" in c.get("location", {}) and "khasraNo" in c.get("land", {})
    ]
    key_counts = Counter(block_keys)
    dup_pairs  = sum(1 for v in key_counts.values() if v >= 2)
    res.check("5C. Duplicate pairs on (village, khasra) — ≥5 pairs",
              dup_pairs >= 5,
              f"Found: {dup_pairs} pair(s)")

    # ── 5. Scenario D — spatial cluster ───────────────────────────────────────
    cell_counts: dict = {}
    for c in claims:
        geo = c.get("geo", {})
        if "lat" in geo and "lon" in geo:
            cell = grid_cell(geo["lat"], geo["lon"])
            cell_counts[cell] = cell_counts.get(cell, 0) + 1

    max_cell = max(cell_counts.values(), default=0)
    res.check("5D. Spatial cluster in one 0.25°×0.25° cell (≥8 claims)",
              max_cell >= 8,
              f"Densest cell: {max_cell} claims")

    # ── 5. Scenario E — hero claim ────────────────────────────────────────────
    hero = next((c for c in claims if c.get("claimId") == HERO_ID), None)
    hero_found = hero is not None

    if hero:
        land = hero.get("land", {})
        claimed = land.get("areaClaimedHa", 0)
        record  = land.get("areaInRecordHa", 0)
        has_mismatch = record > 0 and abs(claimed - record) / record > 0.30

        stages = hero.get("stages", {})
        has_bottleneck = False
        if "sdlcDecision" in stages and "dlcDecision" in stages:
            dur = (parse_date(stages["dlcDecision"])
                   - parse_date(stages["sdlcDecision"])).days
            has_bottleneck = dur > 300

        geo = hero.get("geo", {})
        hero_cell = grid_cell(geo.get("lat", 0), geo.get("lon", 0)) if geo else ""
        hero_cell_count = cell_counts.get(hero_cell, 0)
        has_cluster = hero_cell_count >= 3   # hero + dup + 3 neighbours

        hero_khasra  = land.get("khasraNo", "")
        hero_village = hero.get("location", {}).get("village", "").lower()
        has_dup = any(
            c.get("claimId") != HERO_ID
            and c.get("land", {}).get("khasraNo") == hero_khasra
            and c.get("location", {}).get("village", "").lower()[:4] == hero_village[:4]
            for c in claims
        )

        all_signals = has_mismatch and has_bottleneck and has_cluster and has_dup
        detail = (
            f"mismatch={has_mismatch} bottleneck={has_bottleneck} "
            f"cluster={has_cluster} duplicate={has_dup}"
        )
    else:
        all_signals = False
        detail = f"Hero claim {HERO_ID} not found"

    res.check("5E. Hero claim exists", hero_found, HERO_ID)
    res.check("5E. Hero carries all 4 signals", all_signals, detail)

    # ── 6. Sanity checks ─────────────────────────────────────────────────────
    count = len(claims)
    res.check("6a. Claim count in [300, 800]",
              300 <= count <= 800, f"{count} claims")

    districts = {c["location"]["district"] for c in claims}
    res.check("6b. At least 8 districts",
              len(districts) >= 8, f"{len(districts)} districts")

    bad_area = sum(
        1 for c in claims
        if not (0 < c.get("land", {}).get("areaClaimedHa", -1) <= 200)
    )
    res.check("6c. Areas in range (0, 200] Ha",
              bad_area == 0, f"{bad_area} out-of-range area(s)")


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if not os.path.exists(DATA_FILE):
        print(f"[ERROR]  File not found: {DATA_FILE}")
        print("    Run generate_data.py first.")
        sys.exit(1)

    with open(DATA_FILE, encoding="utf-8") as f:
        try:
            claims = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[ERROR]  Invalid JSON: {e}")
            sys.exit(1)

    if not isinstance(claims, list):
        print("[ERROR]  Expected a JSON array at the top level.")
        sys.exit(1)

    res = Results()
    validate(claims, res)
    res.print_summary()

    if res.all_pass():
        print("\n[OK]  All checks passed. data/generated/claims.json is ready to commit.\n")
        sys.exit(0)
    else:
        failed = sum(1 for r in res.rows if not r[1])
        print(f"\n[FAIL]  {failed} check(s) failed. Fix generate_data.py and re-run.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
