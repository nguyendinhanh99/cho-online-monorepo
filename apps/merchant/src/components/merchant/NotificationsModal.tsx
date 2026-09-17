"use client";

import { useState, useEffect } from "react";
import { db } from "@/services/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch,
  arrayUnion
} from "firebase/firestore";

interface ReplyItem {
  sender: "MERCHANT" | "ADMIN";
  text: string;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  title?: string;
  body?: string;
  message?: string;
  createdAt?: any;
  isRead?: boolean;
  type?: "SYSTEM" | "ACCOUNT" | "ORDER";
  replies?: ReplyItem[]; // Mảng lưu lịch sử phản hồi
}

interface NotificationsModalProps {
  merchantId: string;
  merchantCode?: string;
  onClose: () => void;
}

export function NotificationsModal({ merchantId, merchantCode, onClose }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State quản lý form phản hồi
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // 1. Lắng nghe thông báo Real-time
  useEffect(() => {
    if (!merchantId) return;

    setLoading(true);
    const notifRef = collection(db, "notifications");
    const q = query(notifRef, where("targetUserId", "==", merchantId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: NotificationItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as NotificationItem);
        });

        // Sắp xếp thời gian giảm dần
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });

        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.warn("Lỗi Firestore listener:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [merchantId]);

  // 2. Phím tắt ESC để đóng Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 3. Đánh dấu đã đọc
  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    try {
      const docRef = doc(db, "notifications", item.id);
      await updateDoc(docRef, { isRead: true });
    } catch (err) {
      console.warn("Lỗi cập nhật đã đọc:", err);
    }
  };

  // 4. Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.isRead);
    if (unreadItems.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadItems.forEach((item) => {
        const docRef = doc(db, "notifications", item.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn("Lỗi đánh dấu tất cả đã đọc:", err);
    }
  };

  // 5. Gửi phản hồi (Reply)
  const handleSendReply = async (notifId: string) => {
    if (!replyText.trim()) return;
    setSending(true);

    try {
      const docRef = doc(db, "notifications", notifId);
      const newReply: ReplyItem = {
        sender: "MERCHANT",
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
      };

      await updateDoc(docRef, {
        replies: arrayUnion(newReply),
        isRead: true, // Tự động đánh dấu đã đọc khi phản hồi
      });

      setReplyText("");
      setReplyingId(null);
    } catch (err) {
      console.error("Lỗi khi gửi phản hồi:", err);
      alert("Khởi tạo phản hồi thất bại, vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  // Định dạng thời gian
  const formatTimeAgo = (createdAt: any) => {
    if (!createdAt) return "Vừa xong";
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Vừa xong";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getNotificationIcon = (title?: string, body?: string) => {
    const text = `${title || ""} ${body || ""}`.toLowerCase();
    if (text.includes("khóa") || text.includes("tài khoản")) return { icon: "🔒", bg: "bg-rose-100 text-rose-600" };
    if (text.includes("đơn hàng")) return { icon: "📦", bg: "bg-amber-100 text-amber-600" };
    if (text.includes("duyệt")) return { icon: "✅", bg: "bg-emerald-100 text-emerald-600" };
    return { icon: "🔔", bg: "bg-indigo-100 text-indigo-600" };
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] border border-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg">
              🔔
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                Thông báo hệ thống
                {unreadCount > 0 && (
                  <span className="bg-[#ee4d2d] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {unreadCount} mới
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-stone-400">Cập nhật tin tức & tương tác với Admin</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-stone-500 font-medium text-[11px]">
            {notifications.length} thông báo
          </span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-800 transition cursor-pointer"
            >
              ✓ Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* NOTIFICATION LIST */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-stone-50 animate-pulse space-y-2">
                  <div className="h-4 bg-stone-200 rounded-md w-1/2"></div>
                  <div className="h-3 bg-stone-200 rounded-md w-3/4"></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-2xl mx-auto text-stone-400">
                📭
              </div>
              <p className="font-bold text-stone-700 text-sm">Chưa có thông báo nào</p>
            </div>
          ) : (
            notifications.map((item) => {
              const { icon, bg } = getNotificationIcon(item.title, item.body || item.message);
              const isUnread = !item.isRead;
              const isReplying = replyingId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => handleMarkAsRead(item)}
                  className={`relative p-3.5 rounded-2xl transition-all duration-150 border ${
                    isUnread
                      ? "bg-orange-50/40 border-orange-200/80 shadow-xs"
                      : "bg-stone-50/60 border-stone-200/60"
                  }`}
                >
                  {isUnread && (
                    <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#ee4d2d] ring-4 ring-orange-100"></span>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${bg}`}>
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between items-baseline gap-2 pr-4">
                        <h4 className={`text-xs truncate ${isUnread ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                          {item.title || "Thông báo hệ thống"}
                        </h4>
                      </div>

                      <p className={`text-[11px] leading-relaxed break-words ${isUnread ? "text-stone-800 font-medium" : "text-stone-500"}`}>
                        {item.body || item.message}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-stone-400 font-medium">
                          {formatTimeAgo(item.createdAt)}
                        </span>

                        {/* Nút bật/tắt form Trả lời */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingId(isReplying ? null : item.id);
                            setReplyText("");
                          }}
                          className="text-[11px] text-[#ee4d2d] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          💬 {isReplying ? "Hủy" : "Phản hồi"}
                        </button>
                      </div>

                      {/* Hiển thị danh sách các câu phản hồi cũ */}
                      {item.replies && item.replies.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-stone-200/60 space-y-1.5">
                          {item.replies.map((reply, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded-xl text-[11px] ${
                                reply.sender === "MERCHANT"
                                  ? "bg-white border border-stone-200 text-stone-700 ml-4"
                                  : "bg-orange-100/60 border border-orange-200 text-orange-900 mr-4"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="font-bold text-[10px] text-stone-500">
                                  {reply.sender === "MERCHANT" ? "Bạn" : "Admin"}
                                </span>
                                <span className="text-[9px] text-stone-400">
                                  {formatTimeAgo(reply.createdAt)}
                                </span>
                              </div>
                              <p>{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ô nhập Phản hồi (Show khi click Trả lời) */}
                      {isReplying && (
                        <div 
                          className="mt-3 pt-2.5 border-t border-stone-200/80 space-y-2 animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Nhập nội dung phản hồi cho Admin..."
                            className="w-full p-2.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d]/30 focus:border-[#ee4d2d] resize-none"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyingId(null)}
                              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium text-[11px] transition cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={sending || !replyText.trim()}
                              onClick={() => handleSendReply(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#ee4d2d] hover:bg-[#d63f21] disabled:opacity-50 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                            >
                              {sending ? "Đang gửi..." : "Gửi phản hồi 🚀"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t border-stone-100 bg-white text-right shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-stone-900 hover:bg-black text-white font-bold py-2.5 rounded-2xl transition cursor-pointer text-xs active:scale-[0.99]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}