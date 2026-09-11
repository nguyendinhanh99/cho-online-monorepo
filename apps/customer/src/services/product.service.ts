import { db } from "@cho-online/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Product } from "@cho-online/types";

const PRODUCTS_COLLECTION = "products";

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