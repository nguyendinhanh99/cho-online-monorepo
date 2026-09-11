export type UserRole = 'customer' | 'seller' | 'shipper' | 'admin';

export interface User {
  uid: string;
  phoneNumber: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  shipperDetails?: {
    licensePlate: string;
    idCardNumber: string;
    isOnline: boolean;
    currentLocation?: {
      lat: number;
      lng: number;
    };
  };
}
