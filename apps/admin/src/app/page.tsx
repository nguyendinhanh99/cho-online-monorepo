"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
      setChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-200 gap-3">
      <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
      <p className="text-xs font-semibold text-slate-400 tracking-wide animate-pulse">
        Đang kiểm tra trạng thái đăng nhập...
      </p>
    </div>
  );
}