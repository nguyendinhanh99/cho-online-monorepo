export type UserRole = 
  | "ADMIN"      // Admin tổng (Quản lý toàn bộ 3 hệ thống)
  | "OPERATOR"   // Nhân viên Vận hành
  | "SUPPORT"    // CSKH / Hỗ trợ
  | "MERCHANT"   // Chủ cửa hàng / Quán ăn
  | "SHIPPER"    // Tài xế
  | "CUSTOMER";  // Khách hàng

export type UserStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "REJECTED";

export interface UserProfile {
  uid: string;
  phone: string;
  idCardNumber: string; // Số CCCD (12 chữ số)
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt?: any;
  updatedAt?: any;
  adminSecretKey?: string; // Mã bí mật để tạo Admin/Staff
}

export interface RegisterFormData {
  fullName: string;
  phone: string;
  idCardNumber: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  adminSecretKey?: string; // Mã bí mật để tạo Admin/Staff
}

export interface LoginFormData {
  phone: string;
  idCardNumber: string;
  password: string;
}