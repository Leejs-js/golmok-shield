"use client";

import { useEffect, useRef, useState } from "react";

interface MapPlaceholderProps {
  dongName?: string;
  variant?: "overview" | "detail";
  accentColor?: string;
  overviewRegions?: OverviewRegion[];
}

export interface OverviewRegion {
  name: string;
  rank: number;
  tier: "best" | "worst";
}

interface KakaoMapInstance {
  relayout(): void;
  setBounds(bounds: KakaoBounds): void;
  setCenter(position: KakaoPosition): void;
}

type KakaoPosition = object;

interface KakaoBounds {
  extend(position: KakaoPosition): void;
}

interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoPosition;
  LatLngBounds: new () => KakaoBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoPosition; level: number }
  ) => KakaoMapInstance;
  Marker: new (options: {
    map: KakaoMapInstance;
    position: KakaoPosition;
  }) => unknown;
  Polygon: new (options: {
    map: KakaoMapInstance;
    path: KakaoPosition[] | KakaoPosition[][];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => object;
  event: {
    addListener(target: object, event: string, handler: () => void): void;
  };
  CustomOverlay: new (options: {
    map: KakaoMapInstance;
    position: KakaoPosition;
    content: HTMLElement;
    yAnchor: number;
  }) => unknown;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const MAP_CENTER = { lat: 37.5575, lng: 126.918 };
const SDK_ID = "kakao-map-sdk";
const BOUNDARY_URL = "/data/mapo-dong-boundaries.geojson";

const DONG_COORDINATES: Record<string, { lat: number; lng: number }> = {
  gongdeok: { lat: 37.5502, lng: 126.96 },
  "공덕동": { lat: 37.5502, lng: 126.96 },
  ahyeon: { lat: 37.5537, lng: 126.956 },
  "아현동": { lat: 37.5537, lng: 126.956 },
  dohwa: { lat: 37.5417, lng: 126.9495 },
  "도화동": { lat: 37.5417, lng: 126.9495 },
  yonggang: { lat: 37.5423, lng: 126.943 },
  "용강동": { lat: 37.5423, lng: 126.943 },
  daeheung: { lat: 37.5552, lng: 126.946 },
  "대흥동": { lat: 37.5552, lng: 126.946 },
  yeomni: { lat: 37.5471, lng: 126.946 },
  "염리동": { lat: 37.5471, lng: 126.946 },
  sinsu: { lat: 37.547, lng: 126.935 },
  "신수동": { lat: 37.547, lng: 126.935 },
  seogang: { lat: 37.5477, lng: 126.932 },
  "서강동": { lat: 37.5477, lng: 126.932 },
  seogyo: { lat: 37.5553, lng: 126.918 },
  "서교동": { lat: 37.5553, lng: 126.918 },
  hapjeong: { lat: 37.5496, lng: 126.913 },
  "합정동": { lat: 37.5496, lng: 126.913 },
  mangwon1: { lat: 37.5556, lng: 126.91 },
  "망원1동": { lat: 37.5556, lng: 126.91 },
  mangwon2: { lat: 37.56, lng: 126.902 },
  "망원2동": { lat: 37.56, lng: 126.902 },
  yeonnam: { lat: 37.5645, lng: 126.922 },
  "연남동": { lat: 37.5645, lng: 126.922 },
  seongsan1: { lat: 37.5633, lng: 126.907 },
  "성산1동": { lat: 37.5633, lng: 126.907 },
  seongsan2: { lat: 37.5687, lng: 126.906 },
  "성산2동": { lat: 37.5687, lng: 126.906 },
  sangam: { lat: 37.5783, lng: 126.889 },
  "상암동": { lat: 37.5783, lng: 126.889 },
};

let sdkPromise: Promise<KakaoMaps> | null = null;
let boundaryPromise: Promise<DongBoundary[]> | null = null;

type DongBoundary = {
  name: string;
  polygons: number[][][][];
};

type BoundaryGeoJson = {
  features?: Array<{
    properties?: { dong_nm?: unknown };
    geometry?: { type?: unknown; coordinates?: unknown };
  }>;
};

function loadDongBoundaries(): Promise<DongBoundary[]> {
  if (boundaryPromise) return boundaryPromise;
  boundaryPromise = fetch(BOUNDARY_URL)
    .then((response) => {
      if (!response.ok) throw new Error("행정동 경계 데이터를 불러오지 못했습니다.");
      return response.json() as Promise<BoundaryGeoJson>;
    })
    .then((geoJson) => (geoJson.features ?? []).flatMap((feature) => {
      const name = feature.properties?.dong_nm;
      const geometry = feature.geometry;
      if (typeof name !== "string" || !geometry || !Array.isArray(geometry.coordinates)) return [];
      const polygons = geometry.type === "Polygon"
        ? [geometry.coordinates as number[][][]]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates as number[][][][]
          : [];
      return polygons.length ? [{ name, polygons }] : [];
    }));
  return boundaryPromise;
}

function loadKakaoMaps(): Promise<KakaoMaps> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!appKey) {
      reject(new Error("NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다."));
      return;
    }

    const finishLoading = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };

    if (window.kakao?.maps) {
      finishLoading();
      return;
    }

    const existingScript = document.getElementById(
      SDK_ID
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", finishLoading, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("카카오 지도 SDK 요청에 실패했습니다.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.addEventListener("load", finishLoading, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("카카오 지도 SDK 요청에 실패했습니다.")),
      { once: true }
    );
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function coordinateFor(...keys: Array<unknown>) {
  for (const key of keys) {
    if (typeof key !== "string") continue;
    const coordinate = DONG_COORDINATES[key.trim()];
    if (coordinate) return coordinate;
  }
  return null;
}

function currentDongId() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts.at(-1) ?? "");
}

function createRankMarker(region: OverviewRegion, onClick: () => void) {
  const marker = document.createElement("div");
  const tierLabel = region.tier === "best" ? "추천" : "비추천";
  marker.textContent = `${region.name} · ${tierLabel} ${region.rank}위`;
  marker.setAttribute("aria-label", `${region.name} ${tierLabel} ${region.rank}위`);
  marker.addEventListener("click", onClick);
  Object.assign(marker.style, {
    alignItems: "center",
    background:
      region.tier === "worst"
        ? "#F05A66"
        : "#0099DD",
    border: region.tier === "worst" ? "1px solid #D93D4A" : "1px solid #0077AD",
    borderRadius: "999px",
    boxShadow: "0 3px 10px rgba(0, 153, 221, 0.28)",
    color: "white",
    display: "flex",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
    height: "30px",
    justifyContent: "center",
    padding: "0 10px",
    whiteSpace: "nowrap",
  });
  return marker;
}

export default function MapPlaceholder({
  dongName,
  variant = "overview",
  accentColor = "#0099DD",
  overviewRegions = [],
}: MapPlaceholderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    Promise.all([loadKakaoMaps(), variant === "overview" ? loadDongBoundaries() : Promise.resolve([])])
      .then(([maps, boundaries]) => {
        if (disposed || !containerRef.current) return;

        const detailCoordinate = coordinateFor(dongName, currentDongId());
        const initialCenter = detailCoordinate ?? MAP_CENTER;
        const center = new maps.LatLng(initialCenter.lat, initialCenter.lng);
        const map = new maps.Map(containerRef.current, {
          center,
          level: variant === "detail" ? 4 : 7,
        });

        if (variant === "detail") {
          new maps.Marker({ map, position: center });
          map.setCenter(center);
        } else {
          const visibleRegions = selectedRegion
            ? overviewRegions.filter((region) => region.name === selectedRegion)
            : overviewRegions;
          const boundaryByName = new Map(boundaries.map((boundary) => [boundary.name, boundary]));
          if (visibleRegions.length) {
            const bounds = new maps.LatLngBounds();
            visibleRegions.forEach((region) => {
              const boundary = boundaryByName.get(region.name);
              const coordinate = coordinateFor(region.name);
              if (!boundary || !coordinate) return;
              const color = region.tier === "best" ? "#0099DD" : "#F05A66";

              boundary.polygons.forEach((polygonCoordinates) => {
                const paths = polygonCoordinates.map((ring) => ring.map(([lng, lat]) => {
                  const position = new maps.LatLng(lat, lng);
                  bounds.extend(position);
                  return position;
                }));
                const polygon = new maps.Polygon({
                  map,
                  path: paths,
                  strokeWeight: selectedRegion ? 4 : 2,
                  strokeColor: color,
                  strokeOpacity: 0.95,
                  fillColor: color,
                  fillOpacity: selectedRegion ? 0.48 : 0.28,
                });
                maps.event.addListener(polygon, "click", () => setSelectedRegion(region.name));
              });

              const position = new maps.LatLng(coordinate.lat, coordinate.lng);
              bounds.extend(position);
              new maps.CustomOverlay({
                map,
                position,
                content: createRankMarker(region, () => setSelectedRegion(region.name)),
                yAnchor: 1,
              });
            });
            map.setBounds(bounds);
          }
        }

        resizeObserver = new ResizeObserver(() => map.relayout());
        resizeObserver.observe(containerRef.current);
      })
      .catch((reason: unknown) => {
        if (!disposed) {
          setError(
            reason instanceof Error
              ? reason.message
              : "카카오 지도를 표시하지 못했습니다."
          );
        }
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
    };
  }, [accentColor, dongName, overviewRegions, selectedRegion, variant]);

  const heightClass =
    variant === "detail" ? "h-[320px] sm:h-[400px]" : "h-[220px]";

  return (
    <div
      className={`relative ${heightClass} rounded-card overflow-hidden bg-[#E7EEF3] shadow-md mb-4 sm:mb-5`}
    >
      <div ref={containerRef} className="absolute inset-0" aria-label="카카오 지도" />

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E7EEF3] px-5 text-center text-sm font-semibold text-[#5E7185]">
          {error}
        </div>
      )}

      {!error && variant === "overview" && (
        <div className="pointer-events-none absolute left-3.5 bottom-3 z-10 flex gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-navy bg-white/90 px-2.5 py-1 rounded-lg shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-navy" />
            추천 1~3위
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-status-danger bg-white/90 px-2.5 py-1 rounded-lg shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-status-danger" />
            비추천 1~3위
          </span>
        </div>
      )}

      {!error && variant === "overview" && selectedRegion && (
        <button
          type="button"
          onClick={() => setSelectedRegion(null)}
          className="absolute right-3.5 top-3 z-10 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-extrabold text-navy shadow-md"
        >
          전체 6개 지역 보기
        </button>
      )}

      {!error && variant === "detail" && (
        <span
          className="pointer-events-none absolute left-3.5 top-3.5 z-10 inline-flex items-center gap-1.5 text-xs font-bold bg-white/90 px-3 py-1.5 rounded-[9px] shadow-sm"
          style={{ color: accentColor }}
        >
          {dongName || "선택 지역"} 상권
        </span>
      )}
    </div>
  );
}
