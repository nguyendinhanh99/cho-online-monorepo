import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./firebase";
import { KYCFormData } from "@/types/merchant.type";

// Upload ảnh CCCD lên Firebase Storage
export const uploadKYCImage = async (file: File, pathName: string): Promise<string> => {
  const storageRef = ref(storage, `kyc-documents/${Date.now()}_${pathName}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

// Lưu hồ sơ Merchant lên Firestore
export const submitMerchantKYC = async (userId: string, data: KYCFormData) => {
  const merchantRef = doc(db, "merchants", userId);
  await setDoc(
    merchantRef,
    {
      ...data,
      status: "PENDING",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};