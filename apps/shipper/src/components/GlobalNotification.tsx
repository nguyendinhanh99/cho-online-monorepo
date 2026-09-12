"use client";

import { useEffect, useRef } from "react";
import { db, auth } from "@cho-online/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function GlobalNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(false);
  const isAudioUnlocked = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // 1. Khởi tạo Audio & BroadcastChannel để giao tiếp giữa các tab trình duyệt
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.load();

    // Khởi tạo BroadcastChannel để đồng bộ thông báo giữa nhiều tab trình duyệt mở cùng lúc
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      broadcastChannelRef.current = new BroadcastChannel("shipper_order_notifications");
      
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.type === "NEW_ORDER") {
          triggerAlert(event.data.orderId, event.data.storeName);
        }
      };
    }

    // Tự động unlock âm thanh ngay khi chạm/click bất kỳ đâu
    const unlockAudio = () => {
      if (audioRef.current && !isAudioUnlocked.current) {
        audioRef.current.muted = true;
        const playPromise = audioRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.muted = false;
              }
              isAudioUnlocked.current = true;
              console.log("🔊 Âm thanh đã sẵn sàng phát!");
            })
            .catch(() => {});
        }
      }
    };

    window.addEventListener("click", unlockAudio, { capture: true });
    window.addEventListener("touchstart", unlockAudio, { capture: true });
    window.addEventListener("keydown", unlockAudio, { capture: true });

    return () => {
      window.removeEventListener("click", unlockAudio, { capture: true });
      window.removeEventListener("touchstart", unlockAudio, { capture: true });
      window.removeEventListener("keydown", unlockAudio, { capture: true });
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // 2. Hàm phát âm thanh an toàn
  const playSound = () => {
    if (!audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      audioRef.current.muted = false;
      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("🔇 Trình duyệt tạm chặn âm thanh tự động:", error.message);
        });
      }
    } catch (err) {
      console.error("Lỗi âm thanh:", err);
    }
  };

  // 3. Hàm kích hoạt toàn bộ báo hiệu (Chuông, Rung, Push Notification)
  const triggerAlert = (orderId: string, storeName?: string) => {
    // 1. Chuông
    playSound();

    // 2. Rung
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([500, 250, 500, 250, 500]);
    }

    // 3. System Web Notification (Hoạt động tốt cả khi Tab đang ở background)
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🛵 CÓ ĐƠN HÀNG MỚI!", {
          body: `Đơn #${orderId.slice(0, 8)} từ ${storeName || "Cửa hàng"}`,
          icon: "/favicon.ico",
          tag: orderId, // Tránh trùng lặp thông báo
          requireInteraction: true,
        });
      }
    }
  };

  // 4. Lắng nghe Firestore Realtime khi người dùng đăng nhập
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

      const ordersRef = collection(db, "orders");
      const validStatuses = [
        "pending",
        "finding_driver",
        "preparing",
        "processing",
        "accepted",
        "created",
      ];

      unsubscribeOrders = onSnapshot(
        ordersRef,
        (snapshot) => {
          if (!isMountedRef.current) {
            isMountedRef.current = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              const status = (data.status || "pending").toLowerCase();

              if (!data.shipperId && validStatuses.includes(status)) {
                // Kích hoạt báo hiệu tại tab hiện tại
                triggerAlert(change.doc.id, data.storeName);

                // Đồng bộ phát báo hiệu cho các Tab trình duyệt khác
                if (broadcastChannelRef.current) {
                  broadcastChannelRef.current.postMessage({
                    type: "NEW_ORDER",
                    orderId: change.doc.id,
                    storeName: data.storeName,
                  });
                }
              }
            }
          });
        },
        (error) => {
          console.warn("⚠️ Firestore Listener Error:", error.message);
        }
      );
    });

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, []);

  return null;
}