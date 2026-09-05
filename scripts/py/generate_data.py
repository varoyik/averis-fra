"""
generate_data.py
────────────────
Synthetic FRA claim data generator for the Averis-FRA demo.

Run:   python3 scripts/py/generate_data.py
Output: data/generated/claims.json  (~5,800 claims, ~5 MB)

Rules:
  • Seeded with random.Random(1337) — every run is identical.
  • Pure stdlib — no pip install needed.
  • Output field names match the Claim TypeScript interface EXACTLY.
  • Covers ALL 35 Census-2011 states. Madhya Pradesh runs FIRST and exactly
    as the original single-state generator (scenarios A–E, same districts,
    same rng order, MP claim IDs + hero MP-DIN-HERO-001), so MP values stay
    byte-stable. The other 34 states are generated afterwards from
    data/districts.geojson: districts picked per state (sorted + rng.shuffle
    of a copy, min(8, len)), centroids computed from geometry (shoelace),
    and location.state = the exact geojson ST_NM string.
  • Five scenarios embedded: A (bottleneck) · B (mismatch) · C (duplicates)
    D (spatial cluster) · E (hero claim with all signals).

NOTE FOR TEAMMATE A: The Claim type needs geo?: { lat: number; lon: number }
  added to types.ts — the spatial engine and map inset both require it.
"""

import json
import math
import os
import random
from datetime import date, timedelta

# ── Seeded RNG — touch nothing above this line ──────────────────────────────
rng = random.Random(1337)

# ── Output path ──────────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "generated")
OUT_FILE = os.path.join(OUT_DIR, "claims.json")
GEOJSON_FILE = os.path.normpath(os.path.join(OUT_DIR, "..", "districts.geojson"))

# ── Demo state ───────────────────────────────────────────────────────────────
STATE = "Madhya Pradesh"

# ── Districts (Census 2011 names) with target claim count and approx centroid ─
DISTRICTS = [
    # (name, target_count, base_lat, base_lon)
    ("Dindori",      70,  22.94, 81.07),   # Hero district — Scenario E
    ("Mandla",       65,  22.60, 80.38),   # Scenario D spatial cluster
    ("Shahdol",      60,  23.29, 81.35),   # Scenario A bottleneck
    ("Balaghat",     55,  21.81, 80.18),
    ("Seoni",        50,  22.09, 79.54),
    ("Chhindwara",   50,  22.06, 78.93),
    ("Betul",        45,  21.90, 77.90),
    ("Hoshangabad",  40,  22.75, 77.72),
    ("Anuppur",      40,  23.10, 81.69),
    ("Umaria",       35,  23.52, 80.83),
]
# scenario markers
HERO_DISTRICT    = "Dindori"
BOTTLENECK_DIST  = "Shahdol"
CLUSTER_DISTRICT = "Mandla"

# ── Name pools ────────────────────────────────────────────────────────────────
FIRST_NAMES_M = [
    "Ramesh", "Manglu", "Bhagwan", "Lakhan", "Sukh", "Raju", "Dhannu",
    "Buddhu", "Nandlal", "Tulsiram", "Kedarlal", "Motilal", "Sukhlal",
    "Hira", "Ganga", "Shankar", "Mohan", "Ramlal", "Phool", "Bhurelal",
]
FIRST_NAMES_F = [
    "Kamla", "Sarojini", "Phoolbai", "Sunita", "Urmila", "Bhuri",
    "Savitri", "Fulwati", "Sushila", "Munni", "Radha", "Dropadi",
    "Basanti", "Shanti", "Prabha",
]
SURNAMES = [
    "Markam", "Tekam", "Uikey", "Poyam", "Dhurve", "Netam", "Sori",
    "Kawde", "Atram", "Korram", "Watti", "Bhilala", "Gond", "Baiga",
    "Korku", "Panika", "Majhi", "Ekka", "Minj", "Tirkey",
]
VILLAGES = [
    "Bamhani", "Ghughri", "Silpidi", "Mohgaon", "Deohar", "Karanjia",
    "Ghansore", "Nainpur", "Bichhia", "Mawai", "Baihar", "Waraseoni",
    "Lanjhi", "Amarwara", "Tamia", "Shahpur", "Beohari", "Jaisinghnagar",
    "Pushparajgarh", "Pali", "Kotma", "Dhanpuri", "Sohagpur",
    "Umaria", "Chandla", "Singhpur", "Majhgaon", "Birsa",
]
# Extended generic pool for the non-MP states. VILLAGES itself stays untouched
# so the MP block's rng draws and village picks remain byte-identical.
VILLAGES_EXT = [
    "Amarpur", "Balrampur", "Chandpur", "Deoghar", "Ekta", "Faridpur",
    "Gopalpur", "Haripur", "Islampur", "Jagatpur", "Kheri", "Lodha",
    "Madhupur", "Nagla", "Obra", "Paharpur", "Qazipur", "Raghunathpur",
    "Sakti", "Tarapur", "Umri", "Vellalur", "Wadgaon", "Yamunapur",
    "Zindapur", "Baramati", "Dharampur", "Ranipur", "Nandpur", "Malpur",
]
VILLAGES_ALL = VILLAGES + VILLAGES_EXT
FOREST_RANGES = [
    "Mandla Range", "Dindori Range", "Balaghat Range", "Shahdol Range",
    "Seoni Range", "Tamia Range", "Bichhia Range", "Beohari Range",
    "Kotma Range", "Pali Range", "Anuppur Range", "Umaria Range",
]
# tehsils per district (2–3 each)
TEHSILS = {
    "Dindori":     ["Dindori", "Shahpura", "Bajag"],
    "Mandla":      ["Mandla", "Niwas", "Bichhia"],
    "Shahdol":     ["Shahdol", "Beohari", "Jaisinghnagar"],
    "Balaghat":    ["Balaghat", "Waraseoni", "Kirnapur"],
    "Seoni":       ["Seoni", "Lakhnadon", "Ghansore"],
    "Chhindwara":  ["Chhindwara", "Tamia", "Amarwara"],
    "Betul":       ["Betul", "Multai", "Shahpur"],
    "Hoshangabad": ["Hoshangabad", "Sohagpur", "Babai"],
    "Anuppur":     ["Anuppur", "Pushparajgarh", "Kotma"],
    "Umaria":      ["Umaria", "Pali", "Chandia"],
}
GP_SUFFIXES = ["Gram Panchayat", "GP", "Panchayat"]

# ── All-states generation (34 census states; MP handled by the block above) ──
# Short state codes for claim IDs; MP keeps its own "MP-..." IDs.
STATE_CODES = {
    "Andaman & Nicobar Island": "AN",
    "Andhra Pradesh": "AP",
    "Arunanchal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chandigarh": "CH",
    "Chhattisgarh": "CT",
    "Dadara & Nagar Havelli": "DN",
    "Daman & Diu": "DD",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jammu & Kashmir": "JK",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Lakshadweep": "LD",
    "Madhya Pradesh": "MP",  # reference only — the MP block above keeps its own IDs
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "NCT of Delhi": "DL",
    "Nagaland": "NL",
    "Odisha": "OR",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttarakhand": "UK",
    "West Bengal": "WB",
}

# scenario sizes per non-MP state
BOTTLENECK_COUNT = 13  # scenario A (first picked district)
CLUSTER_COUNT    = 10  # scenario D (second picked district)
MISMATCH_COUNT   = 9   # scenario B (scattered across the state)
DUP_PAIRS        = 3   # scenario C (3 pairs = 6 claims)
DISTRICT_TARGET  = 24  # fill target per district (totals stay in [20, 28])

# ── Helpers ───────────────────────────────────────────────────────────────────
def rand_date(start_year: int, end_year: int) -> date:
    start = date(start_year, 1, 1)
    end   = date(end_year, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=rng.randint(0, delta))

def iso(d: date) -> str:
    return d.isoformat()

def pick(lst):
    return lst[rng.randint(0, len(lst) - 1)]

def rand_name(female_prob: float = 0.35):
    if rng.random() < female_prob:
        first = pick(FIRST_NAMES_F)
    else:
        first = pick(FIRST_NAMES_M)
    last = pick(SURNAMES)
    return first, last

def khasra() -> str:
    num  = rng.randint(100, 999)
    frac = rng.randint(1, 9)
    return f"{num}/{frac}" if rng.random() < 0.6 else str(num)

def drift_spelling(name: str) -> str:
    """Apply one small spelling mutation to a name or village string."""
    ops = rng.randint(0, 3)
    if ops == 0 and len(name) > 3:
        # drop a vowel in the middle
        vowels = [i for i, c in enumerate(name[1:-1], 1) if c in "aeiouAEIOU"]
        if vowels:
            i = pick(vowels)
            return name[:i] + name[i+1:]
    if ops == 1:
        # double a consonant
        cons = [i for i, c in enumerate(name[1:-1], 1) if c not in "aeiouAEIOU "]
        if cons:
            i = pick(cons)
            return name[:i+1] + name[i] + name[i+1:]
    if ops == 2:
        # insert "Kumar" or "Devi" in first name part
        parts = name.split()
        insert = "Kumar" if rng.random() < 0.5 else "Devi"
        if len(parts) == 2:
            return f"{parts[0]} {insert} {parts[1]}"
    # swap two adjacent chars
    if len(name) > 4:
        i = rng.randint(1, len(name) - 3)
        lst = list(name)
        lst[i], lst[i+1] = lst[i+1], lst[i]
        return "".join(lst)
    return name + "i"

def build_stages(receipt: date, fast=False, bottleneck=False, keep_dlc=False) -> dict:
    """
    Generate sequential stage timestamps.
    fast=True       -> shorter durations (already resolved claims).
    bottleneck=True -> DLC stage inflated to 400-700 days (Scenario A).
    keep_dlc=True   -> do not prune dlcDecision even if status=pending.
    Returns dict of stage ISO strings (some may be None for pending claims).
    """
    gs_days   = rng.randint(15, 60)
    sdlcf_days = rng.randint(20, 60)
    sdlcd_days = rng.randint(30, 90)
    dlc_days  = rng.randint(60, 150) if not bottleneck else rng.randint(400, 700)
    title_days = rng.randint(30, 90)

    if fast:
        gs_days, sdlcf_days, sdlcd_days, dlc_days, title_days = (
            rng.randint(10, 30), rng.randint(10, 30),
            rng.randint(15, 45), rng.randint(30, 90), rng.randint(15, 45),
        )

    gs   = receipt + timedelta(days=gs_days)
    sdlcF = gs + timedelta(days=sdlcf_days)
    sdlcD = sdlcF + timedelta(days=sdlcd_days)
    dlc   = sdlcD + timedelta(days=dlc_days)
    title = dlc + timedelta(days=title_days)

    return {
        "gsResolution": iso(gs),
        "sdlcForward":  iso(sdlcF),
        "sdlcDecision": iso(sdlcD),
        "dlcDecision":  iso(dlc),
        "titleIssued":  iso(title),
    }

def make_claim(
    claim_id: str,
    district: str,
    base_lat: float,
    base_lon: float,
    *,
    state=None,
    tehsils=None,
    village_pool=None,
    forest_ranges=None,
    receipt_years=None,
    status_override=None,
    area_mismatch=False,
    bottleneck=False,
    cluster_geo=False,
    cluster_centre=None,
    hero=False,
) -> dict:
    """Build one Claim dict — all values from `rng`."""
    first, last = rand_name()
    name = f"{first} {last}"
    father_first = pick(FIRST_NAMES_M)
    father_name  = f"{father_first} {last}"

    cat  = rng.choices(["ST", "OTFD", "PVTG"], weights=[70, 25, 5])[0]
    rt   = rng.choices(["IFR", "CFR", "CFRR", "HABITAT"], weights=[75, 15, 8, 2])[0]

    area_claimed = round(
        rng.uniform(0.5, 4.0) if rt == "IFR" else rng.uniform(5.0, 50.0), 2
    )

    if hero:
        # Scenario E: area mismatch of ~45%
        direction = 1 if rng.random() < 0.5 else -1
        area_record = round(area_claimed * (1 + direction * 0.45), 2)
    elif area_mismatch:
        # Scenario B: >30% mismatch
        direction = 1 if rng.random() < 0.5 else -1
        pct = rng.uniform(0.35, 0.80)
        area_record = round(area_claimed * (1 + direction * pct), 2)
        area_record = max(0.1, area_record)
    else:
        # Normal: <10% off
        area_record = round(area_claimed * rng.uniform(0.93, 1.07), 2)

    occupancy = rand_date(1970, 2005)
    ry        = receipt_years if receipt_years is not None else (2018, 2024)
    receipt   = rand_date(*ry)
    if receipt <= occupancy:
        receipt = occupancy + timedelta(days=365 * 13)

    tehsil   = pick(tehsils if tehsils is not None else TEHSILS[district])
    village  = pick(village_pool if village_pool is not None else VILLAGES)
    gp       = f"{village} {pick(GP_SUFFIXES)}"
    fr_range = pick(forest_ranges if forest_ranges is not None else FOREST_RANGES)

    # Stages and status
    if status_override:
        status = status_override
    else:
        status = rng.choices(
            ["pending", "titleIssued", "rejected"], weights=[70, 20, 10]
        )[0]

    fast_stages = status == "titleIssued"
    stages_all = build_stages(
        receipt,
        fast=fast_stages,
        bottleneck=bottleneck,
    )

    if hero:
        # Hero: overwrite DLC to exactly 510 days after SDLC decision
        stages_all["dlcDecision"] = iso(
            date.fromisoformat(stages_all["sdlcDecision"]) + timedelta(days=510)
        )
        # Keep titleIssued for reference but status stays pending -> prune below
        title_date = date.fromisoformat(stages_all["dlcDecision"]) + timedelta(days=45)
        stages_all["titleIssued"] = iso(title_date)

    # Prune stages based on status
    if status == "pending" and not hero:
        # randomly stop at a stage - don't include titleIssued
        stop = rng.choices(
            ["dlcDecision", "sdlcDecision", "sdlcForward"],
            weights=[60, 30, 10],
        )[0]
        prune_after = {
            "sdlcForward":  ["sdlcDecision", "dlcDecision", "titleIssued"],
            "sdlcDecision": ["dlcDecision", "titleIssued"],
            "dlcDecision":  ["titleIssued"],
        }
        for key in prune_after.get(stop, []):
            stages_all[key] = None
    elif status == "pending" and hero:
        # Hero is pending at DLC: keep all stages through dlcDecision, drop titleIssued
        stages_all["titleIssued"] = None
    elif status == "rejected":
        stages_all["titleIssued"] = None
        # rejected at DLC or SDLC
        if rng.random() < 0.5:
            stages_all["dlcDecision"] = None
    elif bottleneck and status == "pending":
        # Non-hero bottleneck: keep dlcDecision present, just drop titleIssued
        stages_all["titleIssued"] = None

    # Geo coordinate
    if cluster_geo and cluster_centre:
        lat = cluster_centre[0] + rng.uniform(-0.025, 0.025)
        lon = cluster_centre[1] + rng.uniform(-0.025, 0.025)
    else:
        lat = base_lat + rng.uniform(-0.3, 0.3)
        lon = base_lon + rng.uniform(-0.3, 0.3)

    stages_out = {k: v for k, v in stages_all.items() if v is not None}

    return {
        "claimId": claim_id,
        "receiptDate": iso(receipt),
        "status": status,
        "claimant": {
            "name": name,
            "fatherName": father_name,
            "category": cat,
        },
        "location": {
            "state": state if state is not None else STATE,
            "district": district,
            "tehsil": tehsil,
            "gramPanchayat": gp,
            "village": village,
        },
        "land": {
            "khasraNo": khasra(),
            "forestRange": fr_range,
            "areaClaimedHa": area_claimed,
            "areaInRecordHa": area_record,
        },
        "rightType": rt,
        "occupancySince": iso(occupancy),
        "stages": stages_out,
        "evidenceCount": 7 if hero else rng.randint(2, 8),
        "geo": {"lat": round(lat, 6), "lon": round(lon, 6)},
    }

# ── Main generation ───────────────────────────────────────────────────────────
def generate() -> list:
    claims = []
    counters = {d[0]: 0 for d in DISTRICTS}

    def next_id(district: str) -> str:
        code = district[:3].upper()
        counters[district] += 1
        return f"MP-{code}-{counters[district]:04d}"

    # ── Scenario A — Bottleneck claims in Shahdol (20 claims) ---------------
    bottleneck_ids = set()
    shd = next(d for d in DISTRICTS if d[0] == BOTTLENECK_DIST)
    for _ in range(20):
        cid = next_id(BOTTLENECK_DIST)
        c = make_claim(
            cid, BOTTLENECK_DIST, shd[2], shd[3],
            bottleneck=True, status_override="pending",
        )
        # Ensure dlcDecision is NOT pruned: force it present
        stages = c["stages"]
        if "sdlcDecision" in stages and "dlcDecision" not in stages:
            sdlc_d = date.fromisoformat(stages["sdlcDecision"])
            dlc_d  = sdlc_d + timedelta(days=rng.randint(400, 700))
            stages["dlcDecision"] = iso(dlc_d)
        claims.append(c)
        bottleneck_ids.add(cid)

    # ── Scenario B — Area mismatch claims (25 claims, scattered) ─────────────
    mismatch_districts = [d for d in DISTRICTS if d[0] not in (HERO_DISTRICT, BOTTLENECK_DIST)]
    for i in range(25):
        dist = mismatch_districts[i % len(mismatch_districts)]
        cid = next_id(dist[0])
        c = make_claim(cid, dist[0], dist[2], dist[3], area_mismatch=True)
        claims.append(c)

    # ── Scenario C — Duplicate pairs (8 pairs = 16 claims) ------------------
    # Blocking key for duplicate detection is (village, khasraNo) — EXACT match.
    # We drift only the claimant NAME (spelling drift) to simulate near-duplicates.
    dup_districts = [d for d in DISTRICTS if d[0] not in (HERO_DISTRICT,)]
    for pair_idx in range(8):
        dist = dup_districts[pair_idx % len(dup_districts)]
        shared_khasra  = khasra()
        shared_village = pick(VILLAGES)

        # Original claim
        cid_a = next_id(dist[0])
        orig = make_claim(cid_a, dist[0], dist[2], dist[3])
        orig["land"]["khasraNo"]         = shared_khasra
        orig["location"]["village"]       = shared_village
        orig["location"]["gramPanchayat"] = f"{shared_village} {pick(GP_SUFFIXES)}"
        claims.append(orig)

        # Drifted clone — SAME village + khasra (blocking key exact), drifted name only
        cid_b = next_id(dist[0])
        clone = make_claim(cid_b, dist[0], dist[2], dist[3])
        clone["land"]["khasraNo"]         = shared_khasra
        clone["location"]["village"]       = shared_village          # EXACT same
        clone["location"]["gramPanchayat"] = orig["location"]["gramPanchayat"]  # same GP
        clone["claimant"]["name"]          = drift_spelling(orig["claimant"]["name"])
        claims.append(clone)

    # ── Scenario D — Spatial cluster in Mandla (12 claims) ───────────────────
    mandla = next(d for d in DISTRICTS if d[0] == CLUSTER_DISTRICT)
    cluster_centre = (mandla[2] + 0.05, mandla[3] + 0.05)  # tight sub-area
    for _ in range(12):
        cid = next_id(CLUSTER_DISTRICT)
        c = make_claim(
            cid, CLUSTER_DISTRICT, mandla[2], mandla[3],
            cluster_geo=True, cluster_centre=cluster_centre,
        )
        claims.append(c)

    # ── Scenario E — Hero claim (Dindori, all signals) ───────────────────────
    din = next(d for d in DISTRICTS if d[0] == HERO_DISTRICT)
    hero_centre = (din[2] + 0.03, din[3] + 0.03)

    # Hero claim
    hero = make_claim(
        "MP-DIN-HERO-001", HERO_DISTRICT, din[2], din[3],
        hero=True, bottleneck=True, area_mismatch=True,
        cluster_geo=True, cluster_centre=hero_centre,
        status_override="pending",
    )
    hero["evidenceCount"] = 7
    claims.append(hero)

    # Hero's duplicate pair — SAME khasra + village (blocking key exact), drifted name
    hero_dup = make_claim(
        "MP-DIN-HERO-002", HERO_DISTRICT, din[2], din[3],
        cluster_geo=True, cluster_centre=hero_centre,
        status_override="pending",
    )
    hero_dup["land"]["khasraNo"]         = hero["land"]["khasraNo"]
    hero_dup["location"]["village"]       = hero["location"]["village"]  # EXACT same
    hero_dup["location"]["gramPanchayat"] = hero["location"]["gramPanchayat"]  # same GP
    hero_dup["claimant"]["name"]          = drift_spelling(hero["claimant"]["name"])
    claims.append(hero_dup)

    # 3 more claims near hero to form the mini spatial cluster
    for i in range(3):
        cid = next_id(HERO_DISTRICT)
        c = make_claim(
            cid, HERO_DISTRICT, din[2], din[3],
            cluster_geo=True, cluster_centre=hero_centre,
        )
        claims.append(c)

    # ── Fill remaining normal claims per district ─────────────────────────────
    scenario_counts = {d[0]: 0 for d in DISTRICTS}
    for c in claims:
        scenario_counts[c["location"]["district"]] = (
            scenario_counts.get(c["location"]["district"], 0) + 1
        )

    for dist_name, target, blat, blon in DISTRICTS:
        already = scenario_counts.get(dist_name, 0)
        remaining = max(0, target - already)
        for _ in range(remaining):
            cid = next_id(dist_name)
            c = make_claim(cid, dist_name, blat, blon)
            claims.append(c)

    # Shuffle so scenarios aren't all at the top
    rng.shuffle(claims)

    # ── Other states — all 34 census states except Madhya Pradesh ──
    generate_other_states(claims)

    # Final mix so all states are interleaved
    rng.shuffle(claims)
    return claims

def centroid_from_geometry(geom) -> tuple:
    """
    Approx centroid of a Polygon/MultiPolygon feature.
    Polygon -> largest ring; MultiPolygon -> polygon with the largest ring.
    Shoelace formula over the ring; returns (lat, lon). Rings are [lon, lat].
    """
    if geom["type"] == "Polygon":
        ring = max(geom["coordinates"], key=len)
    else:  # MultiPolygon
        best_ring, best_len = None, -1
        for poly in geom["coordinates"]:
            for r in poly:
                if len(r) > best_len:
                    best_ring, best_len = r, len(r)
        ring = best_ring
    n = len(ring)
    if n < 3:
        return ring[0][1], ring[0][0]
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        area2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(area2) < 1e-12:
        return ring[0][1], ring[0][0]
    return cy / (3 * area2), cx / (3 * area2)  # (lat, lon)


def generate_other_states(claims: list) -> None:
    """Append claims for every census state except Madhya Pradesh."""
    with open(GEOJSON_FILE, encoding="utf-8") as f:
        gj = json.load(f)

    by_state = {}
    for feat in gj["features"]:
        by_state.setdefault(feat["properties"]["ST_NM"], []).append(feat)

    # Every MP claimId (incl. MP-DIN-HERO-*) is already in `claims`.
    seen_ids = {c["claimId"] for c in claims}

    for state in sorted(n for n in by_state if n != STATE):
        feats = by_state[state]
        code = STATE_CODES[state]

        # Seeded district pick: sorted names, shuffle a COPY, take min(8, len)
        names = sorted(f["properties"]["DISTRICT"] for f in feats)
        order = names[:]
        rng.shuffle(order)
        picked = order[: min(8, len(order))]
        picked_set = set(picked)

        centroids = {}
        for f in feats:
            nm = f["properties"]["DISTRICT"]
            if nm in picked_set:
                centroids[nm] = centroid_from_geometry(f["geometry"])

        counters = {d: 0 for d in picked}
        dist_counts = {d: 0 for d in picked}
        tehsils_map = {d: [d, f"{d} North", f"{d} South"] for d in picked}
        ranges_map = {d: [f"{d} Range", "State Forest Range"] for d in picked}

        def next_id(district: str) -> str:
            counters[district] += 1
            base = f"{code}-{district[:3].upper()}-{counters[district]:04d}"
            cid = base
            n = 2
            while cid in seen_ids:
                cid = f"{base}-{n}"
                n += 1
            seen_ids.add(cid)
            return cid

        def add(c: dict) -> None:
            claims.append(c)
            dist_counts[c["location"]["district"]] += 1

        def mk(district: str, **kw) -> dict:
            lat, lon = centroids[district]
            return make_claim(
                next_id(district), district, lat, lon,
                state=state,
                tehsils=tehsils_map[district],
                village_pool=VILLAGES_ALL,
                forest_ranges=ranges_map[district],
                **kw,
            )

        # (a) Scenario A — bottleneck district (first picked), ~13 claims.
        #     Narrower receipt window keeps DLC dates inside the validator
        #     range even with the forced 400-700 day DLC stage.
        bot = picked[0]
        for _ in range(BOTTLENECK_COUNT):
            c = mk(bot, bottleneck=True, status_override="pending",
                   receipt_years=(2018, 2022))
            # Mirror the MP logic: force dlcDecision present
            stages = c["stages"]
            if "sdlcDecision" in stages and "dlcDecision" not in stages:
                sdlc_d = date.fromisoformat(stages["sdlcDecision"])
                stages["dlcDecision"] = iso(
                    sdlc_d + timedelta(days=rng.randint(400, 700))
                )
            add(c)

        # (b) Scenario D — tight ±0.025° cluster in the second picked district
        if len(picked) >= 2:
            clu = picked[1]
            centre = (centroids[clu][0] + 0.05, centroids[clu][1] + 0.05)
            for _ in range(CLUSTER_COUNT):
                add(mk(clu, cluster_geo=True, cluster_centre=centre))

        # (c) Scenario B — area-mismatch claims scattered across the state
        for i in range(MISMATCH_COUNT):
            dist = picked[i % len(picked)]
            add(mk(dist, area_mismatch=True))

        # (d) Scenario C — duplicate pairs (same village + khasra, drifted name)
        for pair_idx in range(DUP_PAIRS):
            dist = picked[(pair_idx * 2) % len(picked)]
            shared_khasra = khasra()
            shared_village = pick(VILLAGES_ALL)
            orig = mk(dist)
            orig["land"]["khasraNo"] = shared_khasra
            orig["location"]["village"] = shared_village
            orig["location"]["gramPanchayat"] = f"{shared_village} {pick(GP_SUFFIXES)}"
            add(orig)
            clone = mk(dist)
            clone["land"]["khasraNo"] = shared_khasra
            clone["location"]["village"] = shared_village
            clone["location"]["gramPanchayat"] = orig["location"]["gramPanchayat"]
            clone["claimant"]["name"] = drift_spelling(orig["claimant"]["name"])
            add(clone)

        # (e) Fill each district to DISTRICT_TARGET total claims
        for dist in picked:
            fill = max(0, DISTRICT_TARGET - dist_counts[dist])
            for _ in range(fill):
                add(mk(dist))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    claims = generate()
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(claims, f, indent=2, ensure_ascii=False)
    print(f"[OK]  Generated {len(claims)} claims -> {OUT_FILE}")

    # Quick sanity
    districts = {c["location"]["district"] for c in claims}
    print(f"    Districts ({len(districts)}): {sorted(districts)}")
    hero = next((c for c in claims if c["claimId"] == "MP-DIN-HERO-001"), None)
    print(f"    Hero claim: {'found' if hero else 'MISSING'}")

    # Per-state coverage summary
    by_state = {}
    for c in claims:
        by_state.setdefault(c["location"]["state"], set()).add(
            c["location"]["district"]
        )
    print(f"    States covered: {len(by_state)}")
    for st in sorted(by_state):
        print(f"      {st}: {len(by_state[st])} districts")


if __name__ == "__main__":
    main()
