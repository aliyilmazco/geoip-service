"use client";

import { useEffect, useRef } from "react";
import L, { type CircleMarker, type Map as LeafletMap } from "leaflet";

type LocationMapCanvasProps = {
  latitude: number;
  longitude: number;
  label: string;
  timezone?: string;
};

const DEFAULT_ZOOM = 11;

function buildPopupContent(
  label: string,
  latitude: number,
  longitude: number,
  timezone?: string
) {
  const root = document.createElement("div");

  const title = document.createElement("strong");
  title.textContent = label;
  root.appendChild(title);

  root.appendChild(document.createElement("br"));
  root.appendChild(
    document.createTextNode(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
  );

  if (timezone) {
    root.appendChild(document.createElement("br"));
    root.appendChild(document.createTextNode(timezone));
  }

  return root;
}

export function LocationMapCanvas({
  latitude,
  longitude,
  label,
  timezone,
}: LocationMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.circleMarker([latitude, longitude], {
      radius: 10,
      color: "#8A6903",
      fillColor: "#C8A227",
      fillOpacity: 0.88,
      weight: 2,
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;

      if ("_leaflet_id" in container) {
        delete (container as HTMLDivElement & { _leaflet_id?: number })
          ._leaflet_id;
      }

      container.innerHTML = "";
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) {
      return;
    }

    const position: [number, number] = [latitude, longitude];
    map.setView(position, DEFAULT_ZOOM);
    marker.setLatLng(position);
    marker.bindPopup(buildPopupContent(label, latitude, longitude, timezone));

    window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [label, latitude, longitude, timezone]);

  return <div ref={containerRef} className="location-map" />;
}
