"use client";

import dynamic from "next/dynamic";

type LocationMapPanelProps = {
  latitude: number;
  longitude: number;
  label: string;
  timezone?: string;
  accuracy?: string;
  isLocal?: boolean;
};

const LocationMapCanvas = dynamic(
  () =>
    import("./location-map-canvas").then((module) => module.LocationMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="location-map-fallback" role="status" aria-live="polite">
        Loading map...
      </div>
    ),
  }
);

export function LocationMapPanel({
  latitude,
  longitude,
  label,
  timezone,
  accuracy,
  isLocal,
}: LocationMapPanelProps) {
  return (
    <section className="detail-section location-map-section">
      <div className="section-heading title-stack">
        <span className="eyebrow">Map</span>
        <h3 className="section-title">Location map</h3>
        <p className="section-description">
          The GeoIP coordinate is centered on an interactive map. This point is
          usually an approximate city-level or region-level match.
        </p>
      </div>

      <div className="location-map-shell">
        <LocationMapCanvas
          latitude={latitude}
          longitude={longitude}
          label={label}
          timezone={timezone}
        />
      </div>

      <div className="location-map-meta">
        <span className="status-badge">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
        {timezone ? <span className="status-badge">{timezone}</span> : null}
        {accuracy ? <span className="status-badge">{accuracy}</span> : null}
        {isLocal ? (
          <span className="status-badge" data-tone="warning">
            Local network
          </span>
        ) : null}
      </div>
    </section>
  );
}
