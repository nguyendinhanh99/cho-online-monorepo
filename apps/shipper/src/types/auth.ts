export type VerificationStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";

export interface ShipperProfile {
  uid: string; // Firebase Auth UID
  fullName: string;
  phone: string;
  email?: string;
  avatarUrl: string;
  
  // Thông tin xe
  vehicleType: "MOTORBIKE" | "ELECTRIC_BIKE";
  licensePlate: string;
  
  // Hồ sơ xác minh (Giấy tờ)
  identityCardNumber: string;
  idCardFrontUrl: string; // Ảnh CCCD mặt trước
  idCardBackUrl: string;  // Ảnh CCCD mặt sau
  driverLicenseUrl: string; // Ảnh Bằng lái xe
  
  status: VerificationStatus;
  rejectionReason?: string; // Lý do nếu bị từ chối
  createdAt: string;
}