import type { SubscriptionStatus } from "@/lib/types";

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Faol";
    case "GRACE_PERIOD":
      return "Grace davri";
    case "SUSPENDED":
      return "To'xtatilgan";
    case "CANCELLED":
      return "Bekor qilingan";
  }
}

export function subscriptionStatusTone(status: SubscriptionStatus): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "GRACE_PERIOD":
      return "warning";
    case "SUSPENDED":
      return "danger";
    case "CANCELLED":
      return "neutral";
  }
}
