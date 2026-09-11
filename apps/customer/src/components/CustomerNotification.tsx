"use client";

import { useEffect, useRef } from "react";
import { db, auth } from "@cho-online/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function CustomerNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.load();
  }, []);

  const playSound = () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (err) {}
  };

  useEffect(() => {
    let unsubscribeOrders: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (unsubscribeOrders) {
          unsubscribeOrders();
          unsubscribeOrders = null;
        }
        return;
      }

      // Đổi thành "customerId" nếu trong Firestore bạn lưu field là customerId
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );

      unsubscribeOrders = onSnapshot(
        q,
        (snapshot) => {
          if (!isMountedRef.current) {
            isMountedRef.current = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "modified") {
              const data = change.doc.data();
              const status = (data.status || "").toLowerCase();

              let statusText = "có cập nhật mới!";
              if (["assigned", "accepted"].includes(status)) statusText = "đã được Shipper nhận!";
              if (status === "picking_up") statusText = "đang được Shipper tới lấy!";
              if (["delivering", "shipping"].includes(status)) statusText = "đang trên đường giao đến bạn!";
              if (status === "completed") statusText = "đã giao thành công!";

              playSound();

              if (typeof window !== "undefined" && "Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification("🛍️ CẬP NHẬT ĐƠN HÀNG", {
                    body: `Đơn hàng #${change.doc.id.slice(0, 8)} ${statusText}`,
                    icon: "/favicon.ico",
                  });
                }
              }
            }
          });
        },
        // Bắt lỗi tại đây để KHÔNG BỊ MÀN HÌNH ĐỎ NEXT.JS TURBOPACK
        (error) => {
          console.warn("⚠️ Firestore Listener Customer bị từ chối quyền:", error.message);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, []);

  return null;
}