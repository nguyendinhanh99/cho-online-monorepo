"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@cho-online/firebase";

export default function GlobalNotification() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef(false);
  const [needUserInteraction, setNeedUserInteraction] = useState(false);

  // 1. Khai báo và load trước âm thanh
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.load();
  }, []);

  // 2. Hàm phát âm thanh an toàn
  const playNotificationSound = () => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = 0;
    audioRef.current
      .play()
      .then(() => {
        setNeedUserInteraction(false);
      })
      .catch((err) => {
        console.warn("Chờ người dùng tương tác để bật chuông:", err);
        setNeedUserInteraction(true);
      });
  };

  // 3. Mở khóa Audio context khi bấm/chạm bất kỳ đâu
  const handleEnableAudio = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
          setNeedUserInteraction(false);
        })
        .catch(() => {});
    }
  };

  // 4. Lắng nghe Firestore Realtime khi đã có Token Auth và merchantCode
  useEffect(() => {
    let unsubscribeOrders: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Nếu chưa đăng nhập -> Hủy Listener cũ và reset trạng thái
      if (!user) {
        if (unsubscribeOrders) {
          unsubscribeOrders();
          unsubscribeOrders = null;
        }
        initializedRef.current = false;
        return;
      }

      try {
        // Lấy merchantCode thuộc về UID đăng nhập hiện tại
        const merchantDoc = await getDoc(doc(db, "merchants", user.uid));
        const merchantData = merchantDoc.data();
        const merchantCode = merchantData?.merchantCode;

        // Nếu không phải tài khoản Merchant hoặc không có merchantCode -> Dừng
        if (!merchantCode) {
          return;
        }

        // LỌC CHÍNH XÁC: Chỉ lắng nghe đơn hàng có merchantCode khớp với shop này
        const q = query(
          collection(db, "orders"),
          where("merchantCode", "==", merchantCode)
        );

        unsubscribeOrders = onSnapshot(
          q,
          (snapshot) => {
            // Bỏ qua đợt nạp dữ liệu ban đầu
            if (!initializedRef.current) {
              initializedRef.current = true;
              return;
            }

            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const newOrder = change.doc.data();
                const status = String(newOrder.status || "").toLowerCase();

                // Kiểm tra đơn hàng mới
                if (status === "pending") {
                  // Phát âm thanh
                  playNotificationSound();

                  // Bật Push Notification
                  if (typeof window !== "undefined" && "Notification" in window) {
                    if (Notification.permission === "granted") {
                      const customer = newOrder.customerName || "Khách hàng";
                      const total = new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(newOrder.totalPrice || 0);

                      new Notification("🛒 CÓ ĐƠN HÀNG MỚI!", {
                        body: `Đơn từ ${customer} - Tổng: ${total}`,
                        icon: "/file.svg",
                        requireInteraction: true,
                      });
                    }
                  }
                }
              }
            });
          },
          (error) => {
            console.warn("⚠️ Firestore Listener tạm thời bị từ chối truy cập:", error.message);
          }
        );
      } catch (error) {
        console.error("Lỗi lấy thông tin merchant cho thông báo:", error);
      }
    });

    // Xin quyền thông báo hệ thống
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

  return (
    <>
      {/* Lớp bắt tương tác ngầm toàn màn hình */}
      <div onClick={handleEnableAudio} className="fixed inset-0 pointer-events-none z-0" />

      {/* Banner cảnh báo Autoplay */}
      {needUserInteraction && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <span>🔔</span>
          <span>Bấm vào màn hình bất kỳ để bật chuông báo đơn mới</span>
          <button
            onClick={handleEnableAudio}
            className="ml-2 bg-[#ee4d2d] px-2 py-1 rounded-md font-bold text-[10px]"
          >
            Bật ngay
          </button>
        </div>
      )}
    </>
  );
}