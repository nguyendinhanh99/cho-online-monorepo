import { db } from "@cho-online/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
} from "firebase/firestore";
import { Product } from "@cho-online/types";

const PRODUCTS_COLLECTION = "products";

// Dữ liệu mẫu khởi tạo cho cửa hàng
const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "Dâu Tây Đà Lạt Tươi",
    description: "Dâu tây giống Mỹ hái tại vườn, ngọt thanh mọng nước",
    price: 120000,
    originalPrice: 150000,
    unit: "Hộp 500g",
    category: "fruit",
    imageUrl:
      "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=500&auto=format&fit=crop&q=60",
    isAvailable: true,
  },
  {
    id: "prod-2",
    name: "Nước Ép Cam Nguyên Chất",
    description: "Cam sành ép tươi 100% không đường, bổ sung Vitamin C",
    price: 35000,
    originalPrice: 40000,
    unit: "Chai 350ml",
    category: "juice",
    imageUrl:
      "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=60",
    isAvailable: true,
  },
  {
    id: "prod-3",
    name: "Nước Ép Cần Tây & Táo",
    description: "Thải độc cơ thể, thanh lọc da và hỗ trợ giảm cân",
    price: 45000,
    unit: "Chai 350ml",
    category: "juice",
    imageUrl:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60",
    isAvailable: true,
  },
  {
    id: "prod-4",
    name: "Xoài Cát Hòa Lộc",
    description: "Xoài chín cây tự nhiên, thơm ngọt đậm đà",
    price: 85000,
    originalPrice: 95000,
    unit: "1 Kg",
    category: "fruit",
    imageUrl:
      "https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=60",
    isAvailable: true,
  },
];

// Lấy danh sách sản phẩm từ Firestore
export async function getProducts(category?: string): Promise<Product[]> {
  try {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    let q = query(productsRef);

    if (category && category !== "all") {
      q = query(productsRef, where("category", "==", category));
    }

    const querySnapshot = await getDocs(q);
    const products: Product[] = [];

    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() } as Product);
    });

    return products;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error);
    return [];
  }
}

// Tự động thêm dữ liệu mẫu vào Firestore nếu chưa có
export async function seedProductsData(): Promise<void> {
  try {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const snapshot = await getDocs(productsRef);

    if (snapshot.empty) {
      for (const prod of INITIAL_PRODUCTS) {
        await setDoc(doc(db, PRODUCTS_COLLECTION, prod.id), prod);
      }
      console.log("Đã tạo thành công dữ liệu sản phẩm mẫu!");
    }
  } catch (error) {
    console.error("Lỗi khi tạo dữ liệu mẫu:", error);
  }
}