import { adminMessaging } from "./firebase-admin"; 
// Lưu ý: Đảm bảo bạn đã export adminMessaging từ file firebase-admin của bạn
// Ví dụ trong firebase-admin.ts: export const adminMessaging = admin.messaging();

interface SendNotificationProps {
  targetTokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification({
  targetTokens,
  title,
  body,
  data = {},
}: SendNotificationProps) {
  // Lọc bỏ các token rỗng hoặc không hợp lệ
  const validTokens = targetTokens.filter((token) => Boolean(token));

  if (validTokens.length === 0) {
    console.log("⚠️ Không có FCM token hợp lệ để gửi thông báo.");
    return { success: false, count: 0 };
  }

  try {
    // Gửi thông báo tới danh sách nhiều thiết bị cùng lúc (Multicast)
    const response = await adminMessaging.sendEachForMulticast({
      tokens: validTokens,
      notification: {
        title,
        body,
      },
      data,
    });

    console.log(`✅ Đã gửi thành công ${response.successCount}/${validTokens.length} thông báo.`);
    return { success: true, count: response.successCount };
  } catch (error) {
    console.error("❌ Lỗi khi gửi FCM Push Notification:", error);
    return { success: false, error };
  }
}