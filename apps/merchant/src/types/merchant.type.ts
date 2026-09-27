export interface Merchant {
  id?: string;
  uid?: string;

  merchantCode?: string;

  shopName?: string;
  storeName?: string;
  name?: string;

  fullName?: string;
  ownerName?: string;

  email?: string;

  phone?: string;
  phoneNumber?: string;

  address?: string;
  storeAddress?: string;

  lat?: number | null;
  lng?: number | null;

  status?: string;

  businessCategory?: string;
  category?: string;

  commissionPercent?: number;

  isOpen?: boolean;

  openTime?: string;
  closeTime?: string;

  avatar?: string;
  avatarUrl?: string;

  /**
   * Cho phép các field Merchant khác
   * mà hệ thống hiện tại đang sử dụng.
   */
  [key: string]: any;
}

/**
 * Dữ liệu form KYC.
 *
 * Tạm thời để kiểu mở nhằm đảm bảo
 * không ảnh hưởng logic cũ khi deploy.
 */
export interface KYCFormData {
  [key: string]: any;
}