"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@cho-online/firebase";

export interface UserProfile {
  uid: string;
  email?: string | null;
  fullName?: string;
  phone?: string;
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // Lấy thêm thông tin chi tiết (tên, role...) từ collection "users" hoặc "shippers"
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email,
              fullName: data.fullName || data.name || currentUser.displayName || "Tài xế",
              phone: data.phone || currentUser.phoneNumber || "",
              role: data.role || "shipper",
            });
          } else {
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email,
              fullName: currentUser.displayName || "Tài xế",
              phone: currentUser.phoneNumber || "",
            });
          }
        } catch (error) {
          console.error("Lỗi lấy thông tin profile:", error);
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            fullName: currentUser.displayName || "Tài xế",
          });
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