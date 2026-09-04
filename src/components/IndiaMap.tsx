import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type * as GeoJSONTypes from "geojson";
import {
  noDataColor,
  riskBand,
  riskColor,
  runEngine,
} from "../analytics/score";
import claims from "../../data/generated/claims.json";
import districtsGeojson from "../../data/districts.geojson";
import stateStats from "../../data/state-stats.json";
import statesGeojson from "../../data/states.geojson";
import type { Claim } from "../lib/types";

export type StateFeature = GeoJSONTypes.Feature<
  GeoJSONTypes.Polygon,
  { ST_NM: string; id: string }
>;
export type DistrictFeature = GeoJSONTypes.Feature<
  GeoJSONTypes.Polygon,
  {
    DISTRICT: string;
    ST_NM: string;
    id: string;
    ST_CEN_CD: string;
    DT_CEN_CD: string;
  }
>;

interface IndiaMapProps {
  selectedState: StateFeature | null;
  onSelectState: (state: StateFeature | null) => void;
  selectedDistrict: string | null;
  onSelectDistrict: (payload: { district: string; state: string }) => void;
}

const INDIA_CENTER: L.LatLngExpression = [22.5, 82];
const INDIA_ZOOM = 5;
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BASE_STYLE: L.PathOptions = {
  weight: 1,
  color: "#34343a",
  fillOpacity: 0.75,
};

const HOVER_STYLE: L.PathOptions = {
  weight: 2,
  color: "#5e6ad2",
  fillOpacity: 0.9,
};

const statesCollection = statesGeojson as GeoJSONTypes.FeatureCollection<
  GeoJSONTypes.Polygon,
  StateFeature["properties"]
>;
const districtsCollection = districtsGeojson as GeoJSONTypes.FeatureCollection<
  GeoJSONTypes.Polygon,
  DistrictFeature["properties"]
>;

function MapContent({
  selectedState,
  onSelectState,
  selectedDistrict,
  onSelectDistrict,
}: IndiaMapProps) {
  const map = useMap();
  const [tilesFailed, setTilesFailed] = useState(false);
  const tileErrorRef = useRef(false);

  const engineOutput = useMemo(() => runEngine(claims as Claim[]), []);
  const statsById = useMemo(
    () => new Map(stateStats.states.map((s) => [s.id, s])),
    [],
  );
  const indiaBounds = useMemo(
    () => L.geoJSON(statesCollection as GeoJSONTypes.GeoJsonObject).getBounds(),
    [],
  );

  const filteredDistricts =
    useMemo<GeoJSONTypes.FeatureCollection<GeoJSONTypes.Polygon> | null>(() => {
      if (!selectedState) return null;
      const stateName = selectedState.properties.ST_NM;
      return {
        type: "FeatureCollection",
        features: districtsCollection.features.filter(
          (f) => f.properties.ST_NM === stateName,
        ),
      };
    }, [selectedState]);

  useEffect(() => {
    if (selectedState) {
      const bounds = L.geoJSON(
        selectedState as GeoJSONTypes.GeoJsonObject,
      ).getBounds();
      map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 8 });
    } else {
      map.flyToBounds(indiaBounds, { padding: [20, 20] });
    }
  }, [selectedState, map, indiaBounds]);

  useEffect(() => {
    if (!selectedState || !selectedDistrict) return;
    const feature = districtsCollection.features.find(
      (f) =>
        f.properties.DISTRICT === selectedDistrict &&
        f.properties.ST_NM === selectedState.properties.ST_NM,
    );
    if (feature) {
      const bounds = L.geoJSON(
        feature as GeoJSONTypes.GeoJsonObject,
      ).getBounds();
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    }
  }, [selectedDistrict, selectedState, map]);

  const stateStyle = (
    feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, unknown>,
  ): L.PathOptions => {
    if (!feature?.properties) return { ...BASE_STYLE, fillColor: noDataColor };
    const props = feature.properties as StateFeature["properties"];
    const stat = statsById.get(props.id);
    if (!stat) return { ...BASE_STYLE, fillColor: noDataColor };
    const score = stat.pending / stat.claimsReceived;
    return { ...BASE_STYLE, fillColor: riskColor(score) };
  };

  const districtStyle = (
    feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, unknown>,
  ): L.PathOptions => {
    if (!feature?.properties) return { ...BASE_STYLE, fillColor: noDataColor };
    const props = feature.properties as DistrictFeature["properties"];
    const result = engineOutput.districts.find(
      (d) => d.district === props.DISTRICT,
    );
    if (!result) return { ...BASE_STYLE, fillColor: noDataColor };
    const isSelected = props.DISTRICT === selectedDistrict;
    return {
      weight: isSelected ? 2 : BASE_STYLE.weight,
      color: isSelected ? "#5e6ad2" : BASE_STYLE.color,
      fillColor: riskColor(result.riskScore),
      fillOpacity: isSelected ? 0.9 : BASE_STYLE.fillOpacity,
    };
  };

  const onEachState = (
    feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, any>,
    layer: L.Layer,
  ) => {
    const props = feature.properties as StateFeature["properties"];
    const stat = statsById.get(props.id);
    const score = stat ? stat.pending / stat.claimsReceived : 0;
    const band = stat ? riskBand(score) : null;
    const pct = stat ? `${(score * 100).toFixed(1)}%` : "—";
    const pending = stat ? stat.pending.toLocaleString() : "—";
    const statusText =
      band === "high"
        ? "High"
        : band === "watch"
          ? "Watch"
          : band === "normal"
            ? "Normal"
            : "No data";
    const dotColor = band ? riskColor(score) : noDataColor;
    const pathLayer = layer as L.Path;

    const content = `
      <div class="font-sans leading-snug">
        <div class="font-medium text-ink">${props.ST_NM}</div>
        <div class="text-ink-muted text-xs">Pending ${pending} · ${pct} backlog</div>
        <div class="mt-1 flex items-center gap-1 text-xs" style="color:${dotColor}">
          <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${dotColor}"></span>
          ${statusText}
        </div>
      </div>
    `;

    pathLayer.bindTooltip(content, {
      sticky: true,
      className: "fra-tooltip",
      direction: "top",
    });

    pathLayer.on("click", () => {
      onSelectState(feature as StateFeature);
    });

    pathLayer.on("mouseover", () => {
      pathLayer.setStyle(HOVER_STYLE);
    });
    pathLayer.on("mouseout", () => {
      pathLayer.setStyle(stateStyle(feature));
    });
  };

  const onEachDistrict = (
    feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, any>,
    layer: L.Layer,
  ) => {
    const props = feature.properties as DistrictFeature["properties"];
    const result = engineOutput.districts.find(
      (d) => d.district === props.DISTRICT,
    );
    const score = result ? result.riskScore : 0;
    const band = result ? riskBand(score) : null;
    const statusText =
      band === "high"
        ? "High"
        : band === "watch"
          ? "Watch"
          : band === "normal"
            ? "Normal"
            : "No data";
    const dotColor = result ? riskColor(score) : noDataColor;
    const claimsText = result
      ? `${result.anomalyCount} flagged · ${result.totalClaims} claims`
      : "No data";
    const pathLayer = layer as L.Path;

    const content = `
      <div class="font-sans leading-snug">
        <div class="font-medium text-ink">${props.DISTRICT}</div>
        <div class="text-ink-muted text-xs">${claimsText}</div>
        <div class="mt-1 flex items-center gap-1 text-xs" style="color:${dotColor}">
          <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:${dotColor}"></span>
          ${statusText}${result ? ` · ${(score * 100).toFixed(1)}%` : ""}
        </div>
      </div>
    `;

    pathLayer.bindTooltip(content, {
      sticky: true,
      className: "fra-tooltip",
      direction: "top",
    });

    pathLayer.on("click", () => {
      onSelectDistrict({ district: props.DISTRICT, state: props.ST_NM });
    });

    pathLayer.on("mouseover", () => {
      pathLayer.setStyle(HOVER_STYLE);
    });
    pathLayer.on("mouseout", () => {
      pathLayer.setStyle(districtStyle(feature));
    });
  };

  const handleTileError = () => {
    if (tileErrorRef.current) return;
    tileErrorRef.current = true;
    setTilesFailed(true);
  };

  return (
    <>
      {!tilesFailed && (
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{ tileerror: handleTileError }}
        />
      )}
      {selectedState && filteredDistricts ? (
        <GeoJSON
          key={`district-${selectedState.properties.id}`}
          data={filteredDistricts}
          style={districtStyle}
          onEachFeature={onEachDistrict}
        />
      ) : (
        <GeoJSON
          key="national"
          data={statesCollection}
          style={stateStyle}
          onEachFeature={onEachState}
        />
      )}
    </>
  );
}

export function IndiaMap({
  selectedState,
  onSelectState,
  selectedDistrict,
  onSelectDistrict,
}: IndiaMapProps) {
  return (
    <section className="relative flex min-h-[20rem] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 lg:min-h-0">
      <div className="absolute left-sm top-sm z-[1000] flex flex-wrap items-center gap-xs">
        <span className="inline-flex items-center rounded-md border border-hairline bg-surface-2 px-xs py-px text-xs text-ink-muted">
          Demo data — synthetic records
        </span>
        {selectedState && (
          <button
            type="button"
            onClick={() => onSelectState(null)}
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-2 px-xs py-px text-xs font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
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
            Back to India
          </button>
        )}
      </div>

      <div className="relative flex-1">
        <MapContainer
          center={INDIA_CENTER}
          zoom={INDIA_ZOOM}
          zoomControl={false}
          className="h-full w-full"
          style={{ background: "#010102" }}
        >
          <MapContent
            selectedState={selectedState}
            onSelectState={onSelectState}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={onSelectDistrict}
          />
        </MapContainer>
      </div>

      <div className="absolute bottom-md left-md z-[1000]">
        <div className="rounded-lg border border-hairline bg-surface-1/95 p-sm text-xs backdrop-blur-sm">
          <div className="mb-1.5 font-medium text-ink">Risk</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-risk-low" />
              <span className="text-ink-muted">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-risk-watch" />
              <span className="text-ink-muted">Watch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-risk-high" />
              <span className="text-ink-muted">High</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-risk-none" />
              <span className="text-ink-muted">No data</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
