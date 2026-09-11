export interface Store {
  id: string;
  ownerUid: string;
  name: string;
  logoUrl?: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  phoneNumber: string;
  bankAccount: {
    bankId: string;
    accountNo: string;
    accountName: string;
  };
  isActive: boolean;
  createdAt: string;
}
