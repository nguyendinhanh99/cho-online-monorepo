"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, collection, query, where, onSnapshot } from "firebase/firestore";

interface ReplyItem {
  sender: "MERCHANT" | "ADMIN";
  text: string;
  createdAt: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  message?: string;
  createdAt: any;
  replies?: ReplyItem[]; // Chuỗi lịch sử phản hồi
}

interface MerchantDetailModalProps {
  merchant: any;
  onClose: () => void;
  onRefresh: () => void;
}

export function MerchantDetailModal({ merchant, onClose, onRefresh }: MerchantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"INFO" | "PRODUCTS" | "NOTIFY">("INFO");
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");

  // State quản lý lịch sử thông báo
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // State quản lý form phản hồi từ phía Admin
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  if (!merchant) return null;

  // Lấy danh sách sản phẩm
  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch(`/api/products?merchantId=${merchant.id}`);
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch (error) {
      console.error("Lỗi lấy sản phẩm:", error);
    } finally {
      setProductsLoading(false);
    }
  };

  // Lắng nghe Lịch sử thông báo & Phản hồi theo thời gian thực (Real-time Firestore)
  useEffect(() => {
    if (activeTab === "PRODUCTS") {
      fetchProducts();
    } else if (activeTab === "NOTIFY") {
      if (!merchant?.id) return;

      setNotificationsLoading(true);
      const notifRef = collection(db, "notifications");
      const q = query(notifRef, where("targetUserId", "==", merchant.id));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: NotificationItem[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as NotificationItem);
          });

          // Sắp xếp giảm dần theo thời gian tạo
          list.sort((a, b) => {
            const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
            const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
            return tB - tA;
          });

          setNotifications(list);
          setNotificationsLoading(false);
        },
        (error) => {
          console.error("Lỗi lắng nghe thông báo Firestore:", error);
          setNotificationsLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [activeTab, merchant.id]);

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi hệ thống?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/products?productId=${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert("🗑️ Đã xóa sản phẩm vi phạm!");
        setSelectedProduct(null);
        fetchProducts();
        onRefresh();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Lỗi khi xóa sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/merchants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: merchant.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        onClose();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      alert("Vui lòng nhập tiêu đề và nội dung thông báo!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: merchant.id,
          title: notifTitle,
          body: notifBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("📢 Đã gửi thông báo thành công!");
        setNotifTitle("");
        setNotifBody("");
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Lỗi gửi thông báo");
    } finally {
      setLoading(false);
    }
  };

  // Admin gửi phản hồi trực tiếp cho thông báo (Cập nhật trực tiếp lên Firestore)
  const handleAdminReply = async (notifId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);

    try {
      const docRef = doc(db, "notifications", notifId);
      const newReply: ReplyItem = {
        sender: "ADMIN",
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
      };

      await updateDoc(docRef, {
        replies: arrayUnion(newReply),
      });

      setReplyText("");
      setReplyingId(null);
    } catch (err) {
      console.error("Lỗi Admin trả lời:", err);
      alert("Gửi phản hồi thất bại!");
    } finally {
      setSendingReply(false);
    }
  };

  const getProductImage = (prod: any) => {
    if (Array.isArray(prod.imageUrls) && prod.imageUrls.length > 0) return prod.imageUrls[0];
    return prod.image || prod.imageUrl || null;
  };

  // Xử lý định dạng thời gian linh hoạt (hỗ trợ cả Firestore Timestamp lẫn ISO String)
  const formatTimeAgo = (createdAt: any) => {
    if (!createdAt) return "Vừa xong";
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/60 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">🏪 {merchant.shopName || merchant.storeName}</h3>
            <p className="text-xs text-slate-400 font-mono">Mã Shop: {merchant.merchantCode || merchant.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 p-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("INFO")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "INFO" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            📊 Thông Tin & Doanh Thu
          </button>
          <button
            onClick={() => setActiveTab("PRODUCTS")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "PRODUCTS" ? "bg-amber-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            📦 Sản Phẩm ({products.length || merchant.totalProducts || 0})
          </button>
          <button
            onClick={() => setActiveTab("NOTIFY")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "NOTIFY" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            🔔 Gửi & Quản Lý Thông Báo
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-xs overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: THÔNG TIN */}
          {activeTab === "INFO" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="text-slate-400 block mb-1">Tổng Doanh Thu</span>
                  <span className="text-lg font-black text-emerald-400">
                    {(merchant.totalRevenue || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="text-slate-400 block mb-1">Đơn Hoàn Tất</span>
                  <span className="text-lg font-black text-indigo-400">{merchant.totalOrders || 0} đơn</span>
                </div>
                <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-2xl">
                  <span className="text-slate-400 block mb-1">Sản Phẩm</span>
                  <span className="text-lg font-black text-amber-400">{merchant.totalProducts || 0} món</span>
                </div>
              </div>

              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 space-y-2.5 text-slate-300">
                <div className="grid grid-cols-2 gap-2">
                  <div>Chủ gian hàng: <b className="text-white">{merchant.fullName || merchant.ownerName}</b></div>
                  <div>SĐT đăng ký: <b className="text-white">{merchant.phone || merchant.phoneNumber}</b></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Mã số thuế: <b className="text-white">{merchant.taxCode || "N/A"}</b></div>
                  <div>Trạng thái: <b className="text-indigo-400">{merchant.status || "APPROVED"}</b></div>
                </div>
                <div>Địa chỉ kinh doanh: <b className="text-white">{merchant.address}</b></div>
              </div>

              <div className="pt-2 flex gap-2">
                {merchant.status === "PENDING" ? (
                  <>
                    <button
                      disabled={loading}
                      onClick={() => handleUpdateStatus("APPROVED")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
                    >
                      ✓ Duyệt Mở Gian Hàng
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleUpdateStatus("REJECTED")}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
                    >
                      ✕ Từ Chối Yêu Cầu
                    </button>
                  </>
                ) : (
                  <button
                    disabled={loading}
                    onClick={() => handleUpdateStatus(merchant.status === "BLOCKED" ? "APPROVED" : "BLOCKED")}
                    className={`flex-1 font-bold py-2.5 rounded-xl text-white transition cursor-pointer ${
                      merchant.status === "BLOCKED" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
                    }`}
                  >
                    {merchant.status === "BLOCKED" ? "🔓 Mở Khóa Gian Hàng" : "🔒 Tạm Khóa Gian Hàng"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* TAB 2: DANH SÁCH SẢN PHẨM */}
          {activeTab === "PRODUCTS" && (
            <div className="space-y-3">
              {productsLoading ? (
                <div className="text-center py-8 text-slate-400">Đang tải danh sách sản phẩm...</div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  Gian hàng này chưa đăng sản phẩm nào.
                </div>
              ) : (
                <div className="grid gap-3">
                  {products.map((product) => {
                    const imgUrl = getProductImage(product);
                    return (
                      <div
                        key={product.id}
                        className="flex gap-4 items-center bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 hover:border-slate-600 transition"
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={product.name}
                            className="w-14 h-14 object-cover rounded-lg bg-slate-800 border border-slate-700"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-xl border border-slate-700">📦</div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-slate-100 text-xs truncate">{product.name}</h4>
                            {product.category && (
                              <span className="bg-slate-700/80 text-amber-300 text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                                {product.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{product.description || "Không có mô tả"}</p>
                        </div>

                        <div className="text-right flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="line-through text-slate-500 text-[10px]">
                                {(Number(product.originalPrice)).toLocaleString("vi-VN")}đ
                              </span>
                            )}
                            <span className="font-bold text-emerald-400 text-xs">
                              {(Number(product.price) || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">Kho: {product.stock ?? 0}</span>
                          <div className="flex gap-1.5 mt-1">
                            <button
                              onClick={() => setSelectedProduct(product)}
                              className="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              👁️ Chi tiết
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => handleDeleteProduct(product.id)}
                              className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              🗑️ Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GỬI THÔNG BÁO & LỊCH SỬ CÓ CHỨC NĂNG PHẢN HỒI REALTIME */}
          {activeTab === "NOTIFY" && (
            <div className="space-y-5">
              {/* Form tạo thông báo mới */}
              <div className="space-y-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Tiêu Đề Thông Báo</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Cảnh báo vi phạm chính sách..."
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Nội Dung Chi Tiết</label>
                  <textarea
                    rows={3}
                    placeholder="Nhập nội dung chi tiết gửi tới Gian hàng..."
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <button
                  disabled={loading}
                  onClick={handleSendNotification}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? "Đang gửi..." : "🚀 Gửi Thông Báo Ngay"}
                </button>
              </div>

              {/* Lịch sử thông báo & trao đổi phản hồi */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📜</span> Lịch Sử Thông Báo & Phản Hồi ({notifications.length})
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Tự động đồng bộ
                  </span>
                </div>

                {notificationsLoading ? (
                  <div className="text-center py-6 text-slate-400 font-medium">Đang tải lịch sử...</div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-800/20 rounded-xl border border-slate-800/80 font-medium">
                    Chưa có lịch sử thông báo nào.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {notifications.map((item) => {
                      const isReplying = replyingId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-2xl space-y-2"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-indigo-300 text-xs">{item.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {formatTimeAgo(item.createdAt)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {item.body || item.message}
                          </p>

                          {/* Lịch sử các câu phản hồi */}
                          {item.replies && item.replies.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-2">
                              {item.replies.map((reply, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-xl text-[11px] ${
                                    reply.sender === "MERCHANT"
                                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-200 mr-4"
                                      : "bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 ml-4"
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-[10px] text-slate-400">
                                      {reply.sender === "MERCHANT" ? "🏪 Gian hàng phản hồi:" : "👑 Admin:"}
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                      {formatTimeAgo(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p>{reply.text}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Nút bật Form trả lời phía Admin */}
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => {
                                setReplyingId(isReplying ? null : item.id);
                                setReplyText("");
                              }}
                              className="text-[11px] text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                              💬 {isReplying ? "Hủy trả lời" : "Trả lời lại"}
                            </button>
                          </div>

                          {/* Form nhập nội dung phản hồi của Admin */}
                          {isReplying && (
                            <div className="mt-2 pt-2 border-t border-slate-700/80 space-y-2 animate-in fade-in duration-150">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Nhập câu trả lời gửi đến Gian hàng..."
                                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] cursor-pointer"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  disabled={sendingReply || !replyText.trim()}
                                  onClick={() => handleAdminReply(item.id)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] transition cursor-pointer"
                                >
                                  {sendingReply ? "Đang gửi..." : "Gửi phản hồi 🚀"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHI TIẾT SẢN PHẨM */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 space-y-4 text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>📦</span> Chi Tiết Sản Phẩm
              </h4>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            {getProductImage(selectedProduct) ? (
              <img
                src={getProductImage(selectedProduct)}
                alt={selectedProduct.name}
                className="w-full h-48 object-cover rounded-xl border border-slate-700"
              />
            ) : (
              <div className="w-full h-32 bg-slate-800 rounded-xl flex items-center justify-center text-3xl border border-slate-700">📦</div>
            )}

            <div className="space-y-2.5">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-black text-base text-white">{selectedProduct.name}</h3>
                {selectedProduct.category && (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0">
                    {selectedProduct.category}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <div>
                  <span className="text-xs text-slate-400 block">Giá bán</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-extrabold text-base">
                      {(Number(selectedProduct.price) || 0).toLocaleString("vi-VN")}đ
                    </span>
                    {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                      <span className="line-through text-slate-500 text-xs">
                        {(Number(selectedProduct.originalPrice)).toLocaleString("vi-VN")}đ
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Tồn kho</span>
                  <span className="text-slate-100 font-bold text-sm">{selectedProduct.stock ?? 0}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${selectedProduct.isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                  {selectedProduct.isAvailable ? "✓ Đang bán" : "✕ Tắt kinh doanh"}
                </span>
                {selectedProduct.isFeatured && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-lg text-[10px] font-bold">
                    ★ Nổi bật
                  </span>
                )}
              </div>

              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 max-h-28 overflow-y-auto">
                <span className="text-slate-400 font-bold block mb-1">Mô tả sản phẩm:</span>
                {selectedProduct.description || "Không có mô tả chi tiết."}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 font-bold py-2 rounded-xl text-slate-300 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => handleDeleteProduct(selectedProduct.id)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 font-bold py-2 rounded-xl text-white transition cursor-pointer"
              >
                🗑️ Xóa Sản Phẩm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}