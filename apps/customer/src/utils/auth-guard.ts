import { auth } from "@cho-online/firebase";

// Kiểm tra trạng thái đăng nhập
export function isUserLoggedIn(): boolean {
  return !!auth.currentUser;
}