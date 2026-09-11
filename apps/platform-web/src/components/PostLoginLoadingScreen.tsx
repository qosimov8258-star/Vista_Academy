"use client";

import { usePostLoginLoading } from "@/lib/post-login-loading";
import { LoadingScreen } from "./LoadingScreen";

// Root layout darajasida chaqiriladi — `isPostLoginLoading` holatini
// LoadingScreen'ning `visible` prop'iga ulaydi.
export function PostLoginLoadingScreen() {
  const { isPostLoginLoading } = usePostLoginLoading();
  return <LoadingScreen visible={isPostLoginLoading} minDurationMs={3000} />;
}
