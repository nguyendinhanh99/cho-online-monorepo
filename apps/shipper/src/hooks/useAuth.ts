"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Khai báo chuẩn cấu trúc dữ liệu theo Firestore của bạn
export interface ShipperProfile {
  uid: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  driverLicenseUrl?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  identityCardNumber?: string;
  licensePlate?: string;
  vehicleType?: string; // Ví dụ: "MOTORBIKE"
  status?: string; // Ví dụ: "APPROVED"
  createdAt?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ShipperProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // Lấy Document theo UID từ Firestore
          const docRef = doc(db, "shippers", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setProfile(docSnap.data() as ShipperProfile);
          } else {
            // Trường hợp chưa có doc trong Firestore
            setProfile({
              uid: currentUser.uid,
              fullName: currentUser.displayName || "Tài xế",
              phone: currentUser.phoneNumber || "",
              avatarUrl: currentUser.photoURL || "",
              status: "PENDING",
            });
          }
        } catch (error) {
          console.error("Lỗi khi tải dữ liệu tài khoản:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, profile, loading };
}