import { auth, db } from "@cho-online/firebase";
import { User } from "@cho-online/types";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const googleProvider = new GoogleAuthProvider();

// Helper biến SĐT thành Email giả lập để dùng với Firebase Auth
const formatPhoneToEmail = (phone: string): string => {
  const cleanPhone = phone.trim().replace(/\s+/g, "");
  return `${cleanPhone}@choonline.internal`;
};

// 1. ĐĂNG NHẬP BẰNG GOOGLE (GMAIL)
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const newUser: any = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? "",
        fullName: firebaseUser.displayName ?? "Khách hàng",
        avatarUrl: firebaseUser.photoURL ?? "",
        role: "customer",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userRef, newUser);
      return newUser as User;
    }

    return userSnap.data() as User;
  } catch (error: any) {
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Cửa sổ đăng nhập Google đã bị đóng.");
    }
    throw new Error("Đăng nhập Google thất bại. Vui lòng thử lại!");
  }
}

// 2. ĐĂNG KÝ BẰNG SĐT + MẬT KHẨU
export async function registerWithPhoneAndPassword(
  phone: string, 
  password: string, 
  fullName: string
): Promise<User> {
  try {
    const virtualEmail = formatPhoneToEmail(phone);

    const userCredential = await createUserWithEmailAndPassword(auth, virtualEmail, password);
    const user = userCredential.user;

    const newUser: any = {
      uid: user.uid,
      phoneNumber: phone,
      fullName: fullName || "Khách hàng",
      role: "customer",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", user.uid), newUser);
    return newUser as User;
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Số điện thoại này đã được đăng ký tài khoản!");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Mật khẩu quá yếu (cần tối thiểu 6 ký tự)!");
    }
    throw new Error("Đăng ký thất bại. Vui lòng thử lại!");
  }
}

// 3. ĐĂNG NHẬP BẰNG SĐT + MẬT KHẨU
export async function loginWithPhoneAndPassword(
  phone: string, 
  password: string
): Promise<User> {
  try {
    const virtualEmail = formatPhoneToEmail(phone);

    const userCredential = await signInWithEmailAndPassword(auth, virtualEmail, password);
    const user = userCredential.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("Không tìm thấy dữ liệu tài khoản!");
    }

    return userSnap.data() as User;
  } catch (error: any) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
      case "auth/invalid-email":
        throw new Error("Số điện thoại hoặc mật khẩu không chính xác.");
      case "auth/too-many-requests":
        throw new Error("Tài khoản bị khóa tạm thời do nhập sai nhiều lần. Vui lòng thử lại sau!");
      default:
        throw new Error(error.message || "Đã xảy ra lỗi đăng nhập. Vui lòng thử lại!");
    }
  }
}

// 4. ĐĂNG XUẤT
export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}