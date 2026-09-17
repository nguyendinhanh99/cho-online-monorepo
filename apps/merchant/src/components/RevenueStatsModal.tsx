"use client";

import { useState, useEffect } from "react";
import { db } from "@/services/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

interface RevenueStatsModalProps {
  merchantId: string;
  onClose: () => void;
}

interface OrderItem {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: any;
  itemsCount?: number;
}

export default function RevenueStatsModal({ merchantId, onClose }: RevenueStatsModalProps) {
  const [filterPeriod, setFilterPeriod] = useState<"today" | "week" | "month" | "all">("month");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    avgOrderValue: 0,
  });

  useEffect(() => {
    async function fetchOrders() {
      if (!merchantId) return;
      setLoading(true);
      try {
        // Query đơn hàng thuộc về merchant
        const q = query(
          collection(db, "orders"),
          where("merchantId", "==", merchantId),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedOrders: OrderItem[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedOrders.push({
            id: doc.id,
            totalAmount: data.totalAmount || data.total || 0,
            status: data.status || "COMPLETED",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            itemsCount: data.items ? data.items.length : 1,
          });
        });

        // Lọc theo thời gian lựa chọn
        const now = new Date();
        const filtered = fetchedOrders.filter((order) => {
          const orderDate = new Date(order.createdAt);
          if (filterPeriod === "today") {
            return orderDate.toDateString() === now.toDateString();
          }
          if (filterPeriod === "week") {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return orderDate >= oneWeekAgo;
          }
          if (filterPeriod === "month") {
            return (
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear()
            );
          }
          return true; // "all"
        });

        // Tính toán chỉ số
        const completed = filtered.filter(
          (o) => o.status === "COMPLETED" || o.status === "DELIVERED" || o.status === "SUCCESS"
        );
        const totalRev = completed.reduce((sum, o) => sum + o.totalAmount, 0);

        setOrders(filtered);
        setStats({
          totalRevenue: totalRev,
          totalOrders: filtered.length,
          completedOrders: completed.length,
          avgOrderValue: completed.length > 0 ? Math.round(totalRev / completed.length) : 0,
        });
      } catch (error) {
        console.error("Lỗi khi tải thống kê doanh thu:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [merchantId, filterPeriod]);

  const formatVND = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
            Thống kê doanh số cửa hàng
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Dynamic Period Filter */}
        <div className="p-4 bg-stone-50 border-b border-stone-100">
          <div className="flex bg-stone-200/60 p-1 rounded-xl text-xs font-semibold gap-1">
            <button
              onClick={() => setFilterPeriod("today")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterPeriod === "today" ? "bg-white text-stone-800 shadow-xs" : "text-stone-500"
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setFilterPeriod("week")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterPeriod === "week" ? "bg-white text-stone-800 shadow-xs" : "text-stone-500"
              }`}
            >
              7 ngày
            </button>
            <button
              onClick={() => setFilterPeriod("month")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterPeriod === "month" ? "bg-white text-stone-800 shadow-xs" : "text-stone-500"
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setFilterPeriod("all")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterPeriod === "all" ? "bg-white text-stone-800 shadow-xs" : "text-stone-500"
              }`}
            >
              Tất cả
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Card Tổng Doanh Thu */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-sm space-y-1">
            <span className="text-[11px] opacity-80 uppercase font-medium tracking-wide">
              Tổng doanh thu thực nhận
            </span>
            <div className="text-2xl font-black">{formatVND(stats.totalRevenue)}</div>
            <div className="text-[10px] opacity-75 pt-1">
              Trung bình đơn: {formatVND(stats.avgOrderValue)}
            </div>
          </div>

          {/* Grid Thống Kê Nhanh */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 border border-stone-100 p-3.5 rounded-xl">
              <span className="text-stone-400 text-[10px] block font-medium">Tổng đơn hàng</span>
              <span className="text-lg font-bold text-stone-800">{stats.totalOrders} đơn</span>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-xl">
              <span className="text-emerald-600 text-[10px] block font-medium">Đơn đã hoàn tất</span>
              <span className="text-lg font-bold text-emerald-700">{stats.completedOrders} đơn</span>
            </div>
          </div>

          {/* Danh sách đơn mới nhất */}
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-stone-700 text-xs">Lịch sử đơn hàng gần đây</h4>

            {loading ? (
              <div className="text-center py-6 text-stone-400 text-xs animate-pulse">
                Đang tải dữ liệu...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-6 text-stone-400 text-xs bg-stone-50 rounded-xl border border-dashed border-stone-200">
                Chưa có đơn hàng nào trong khoảng thời gian này
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex justify-between items-center p-3 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition"
                  >
                    <div>
                      <div className="font-bold text-stone-800 text-xs">#{order.id.slice(0, 8).toUpperCase()}</div>
                      <div className="text-[10px] text-stone-400">
                        {order.createdAt.toLocaleDateString("vi-VN")} - {order.createdAt.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-stone-800 text-xs">{formatVND(order.totalAmount)}</div>
                      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50">
          <button
            onClick={onClose}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}