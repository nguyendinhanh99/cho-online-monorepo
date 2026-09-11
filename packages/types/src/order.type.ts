export type OrderStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  
  storeId: string;
  storeName: string;
  storePhone: string;
  
  shipperUid?: string;
  shipperName?: string;
  shipperPhone?: string;

  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;

  paymentMethod: 'COD' | 'VIETQR';
  paymentStatus: 'UNPAID' | 'PAID';

  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
