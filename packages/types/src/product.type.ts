export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl: string;
  unit: string;
  isAvailable: boolean;
  category: string;
  createdAt: string;
  updatedAt: string;
}
