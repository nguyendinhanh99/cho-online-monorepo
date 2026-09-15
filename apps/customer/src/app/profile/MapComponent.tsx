// src/app/profile/MapComponent.tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icon mặc định của Leaflet trong Next.js
// @ts-expect-error
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapEventsHandler({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  const map = useMap();
  useMapEvents({
    moveend() {
      const center = map.getCenter();
      onCenterChange(center.lat, center.lng);
    },
  });
  return null;
}

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 18, { duration: 1 });
    }
  }, [lat, lng, map]);
  return null;
}

interface MapComponentProps {
  lat: number;
  lng: number;
  onSelect: (lat: number, lng: number) => void;
}

export default function MapComponent({ lat, lng, onSelect }: MapComponentProps) {
  const [currentCenter, setCurrentCenter] = useState({ lat, lng });
  const [isLocating, setIsLocating] = useState(false);
  
  // Trạng thái chuyển đổi bản đồ: 'voyager' (Đường phố chi tiết) hoặc 'satellite' (Vệ tinh)
  const [mapType, setMapType] = useState<"voyager" | "satellite">("satellite");

  const handleCenterChange = (newLat: number, newLng: number) => {
    setCurrentCenter({ lat: newLat, lng: newLng });
    onSelect(newLat, newLng);
  };

// Nút bấm lấy GPS (có cơ chế fallback an toàn nếu thiết bị không hỗ trợ)
  const handleGetMyGPS = () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị!");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        setCurrentCenter({ lat: newLat, lng: newLng });
        onSelect(newLat, newLng);
        setIsLocating(false);
      },
      (error) => {
        console.warn("Không lấy được GPS phần cứng, giữ nguyên vị trí hiện tại:", error);
        // Thay vì hiện alert lỗi, ta thông báo nhẹ nhàng và giữ nguyên map để người dùng tự kéo
        setIsLocating(false);
        // Không gọi alert phiền phức nữa, người dùng có thể tự kéo map đến nhà mình rất trực quan
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  };

  return (
    <div className="relative w-full h-full">
      {/* 🎯 NÚT TỰ ĐỘNG ĐỊNH VỊ GPS */}
      <button
        type="button"
        onClick={handleGetMyGPS}
        disabled={isLocating}
        className="absolute top-4 right-4 z-[1000] bg-white hover:bg-stone-50 text-stone-800 font-bold px-3 py-2 rounded-xl shadow-lg border border-stone-200 text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
      >
        <span>📍</span>
        <span>{isLocating ? "Đang tìm..." : "Vị trí của tôi"}</span>
      </button>

      {/* 🗺️ THANH LỰA CHỌN KIỂU BẢN ĐỒ (VỆ TINH / ĐƯỜNG PHỐ) */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-lg border border-stone-200 flex gap-1">
        <button
          type="button"
          onClick={() => setMapType("satellite")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            mapType === "satellite"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          🛰️ Vệ tinh
        </button>
        <button
          type="button"
          onClick={() => setMapType("voyager")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            mapType === "voyager"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          🗺️ Đường phố
        </button>
      </div>

      {/* 🎯 GHIM CỐ ĐỊNH Ở CHÍNH GIỮA MÀN HÌNH */}
      <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none pb-10">
        <div className="flex flex-col items-center transform -translate-y-4">
          <div className="bg-emerald-600 text-white font-bold text-xs px-3 py-1 rounded-full shadow-xl border-2 border-white whitespace-nowrap animate-bounce">
            🏠 Vị trí nhà bạn
          </div>
          <div className="w-4 h-4 bg-emerald-600 rotate-45 -mt-2 border-2 border-white shadow-md"></div>
          <div className="w-3 h-3 bg-black/80 rounded-full mt-1 animate-ping"></div>
        </div>
      </div>

      <MapContainer
        center={[currentCenter.lat, currentCenter.lng]}
        zoom={18}
        maxZoom={20}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      >
        {/* Thay đổi linh hoạt TileLayer dựa vào lựa chọn của người dùng */}
        {mapType === "satellite" ? (
          // Nền ảnh vệ tinh toàn cầu (ArcGIS World Imagery - Tải mượt, không lỗi xám)
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          // Nền bản đồ đường phố chi tiết, hiện đại (CartoDB Voyager)
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />
        )}
        
        <MapController lat={currentCenter.lat} lng={currentCenter.lng} />
        <MapEventsHandler onCenterChange={handleCenterChange} />
      </MapContainer>
    </div>
  );
}