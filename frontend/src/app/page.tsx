"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import LandingPage from "@/components/landing/landing-page";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/workspaces");
      } else {
        setChecked(true);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || (!checked && !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Loading DocMind...</p>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}
