const markerColors = { best: "#1d6f4b", worst: "#d0644b", neutral: "#62736a" };

export class LeafletMapAdapter {
  constructor(elementId, config) {
    this.config = config;
    this.map = L.map(elementId, { zoomControl: false, attributionControl: true }).setView(config.mapCenter, config.mapZoom);
    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(this.map);
    this.markers = new Map();
    this.bounds = L.latLngBounds([]);
  }

  setResults(results, onSelect) {
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
    this.bounds = L.latLngBounds([]);
    ["best", "worst"].forEach((kind) => {
      results[kind].forEach((area, index) => {
        const color = markerColors[kind];
        const icon = L.divIcon({
          className: "golmok-marker-wrap",
          html: `<div class="golmok-marker ${kind}"><span>${index + 1}</span></div>`,
          iconSize: [38, 48], iconAnchor: [19, 44], popupAnchor: [0, -44],
        });
        const marker = L.marker([area.lat, area.lng], { icon }).addTo(this.map);
        marker.bindPopup(`<div class="map-popup"><small>${kind === "best" ? "추천" : "주의"} ${index + 1}위</small><strong>${area.dong}</strong><span>${area.score}점 · ${area.clusterName}</span></div>`);
        marker.on("click", () => onSelect?.(area, kind));
        this.markers.set(area.dong, marker);
        this.bounds.extend([area.lat, area.lng]);
      });
    });
    this.fitAll();
  }

  focus(dong) {
    const marker = this.markers.get(dong);
    if (!marker) return;
    this.map.flyTo(marker.getLatLng(), 15, { duration: 0.7 });
    marker.openPopup();
  }

  fitAll() {
    if (this.bounds.isValid()) this.map.fitBounds(this.bounds.pad(0.22), { maxZoom: 14 });
  }

  invalidateSize() { this.map.invalidateSize(); }
}

export class KakaoMapAdapter {
  constructor(elementId, config) {
    if (!window.kakao?.maps) throw new Error("Kakao Maps SDK가 로드되지 않았습니다.");
    this.map = new kakao.maps.Map(document.getElementById(elementId), {
      center: new kakao.maps.LatLng(...config.mapCenter), level: 6,
    });
    this.markers = new Map();
  }
  setResults(results) {
    [...results.best, ...results.worst].forEach((area) => {
      const marker = new kakao.maps.Marker({ position: new kakao.maps.LatLng(area.lat, area.lng), map: this.map });
      this.markers.set(area.dong, marker);
    });
  }
  focus(dong) { const marker = this.markers.get(dong); if (marker) this.map.panTo(marker.getPosition()); }
  fitAll() {}
  invalidateSize() { this.map.relayout(); }
}

export function createMapAdapter(elementId, config) {
  return config.mapProvider === "kakao" ? new KakaoMapAdapter(elementId, config) : new LeafletMapAdapter(elementId, config);
}
