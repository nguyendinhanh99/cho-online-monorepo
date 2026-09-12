import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadShipperDocument(file: File, uid: string, documentType: string) {
  // Đường dẫn lưu ảnh: shippers/{uid}/{documentType}_{timestamp}
  const storageRef = ref(storage, `shippers/${uid}/${documentType}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}