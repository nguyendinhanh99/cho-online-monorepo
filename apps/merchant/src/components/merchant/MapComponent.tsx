"use client";

import { useState, useRef } from "react";
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

function MapEventsHandler({ 
  onCenterChange, 
  mapRef 
}: { 
  onCenterChange: (lat: number, lng: number) => void;
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();
  
  // Lưu lại instance của map vào ref ngay khi khởi tạo
  mapRef.current = map;

  useMapEvents({
    moveend() {
      const center = map.getCenter();
      onCenterChange(center.lat, center.lng);
    },
    // Đảm bảo khi người dùng zoom bằng tay, Leaflet cập nhật lại kích thước khung mượt mà
    zoomend() {
      map.invalidateSize();
    }
  });
  return null;
}

interface MapComponentProps {
  lat: number;
  lng: number;
  onSelect: (lat: number, lng: number) => void;
}

export default function MapComponent({ lat, lng, onSelect }: MapComponentProps) {
  // Dùng useRef để lưu trữ tâm ban đầu cố định, không tạo lại state gây re-render giật map
  const initialCenter = useRef({ lat, lng });
  const mapRef = useRef<L.Map | null>(null);
  
  const [isLocating, setIsLocating] = useState(false);
  const [mapType, setMapType] = useState<"voyager" | "satellite">("satellite");

  const handleCenterChange = (newLat: number, newLng: number) => {
    onSelect(newLat, newLng);
  };

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
        onSelect(newLat, newLng);
        
        // Di chuyển mượt đến vị trí GPS mà không ép thay đổi mức zoom hiện tại của người dùng
        if (mapRef.current) {
          mapRef.current.panTo([newLat, newLng]);
        }
        setIsLocating(false);
      },
      (error) => {
        console.warn("Không lấy được GPS phần cứng:", error);
        setIsLocating(false);
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

      {/* 🗺️ THANH LỰA CHỌN KIỂU BẢN ĐỒ */}
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
        center={[initialCenter.current.lat, initialCenter.current.lng]}
        zoom={18}
        maxZoom={20}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      >
        {mapType === "satellite" ? (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />
        )}
        
        <MapEventsHandler onCenterChange={handleCenterChange} mapRef={mapRef} />
      </MapContainer>
    </div>
  );
}