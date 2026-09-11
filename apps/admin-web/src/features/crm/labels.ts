import type { AgeGroup, LeadActivityType, LeadSource, LeadStage } from "@/lib/types";

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "Yangi",
  TRIAL_DAY_SCHEDULED: "Sinov kuni belgilandi",
  CONTRACT: "Shartnoma",
  WON: "Yutildi",
  LOST: "Yo'qotildi",
};

export const STAGE_TONE: Record<LeadStage, "primary" | "warning" | "success" | "danger"> = {
  NEW: "primary",
  TRIAL_DAY_SCHEDULED: "warning",
  CONTRACT: "primary",
  WON: "success",
  LOST: "danger",
};

export const STAGE_ORDER: LeadStage[] = ["NEW", "TRIAL_DAY_SCHEDULED", "CONTRACT", "WON", "LOST"];

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  AGE_1_2: "1-2 yosh",
  AGE_2_3: "2-3 yosh",
  AGE_3_4: "3-4 yosh",
  AGE_4_5: "4-5 yosh",
  AGE_5_6: "5-6 yosh",
  AGE_6_7: "6-7 yosh",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  WEBSITE: "Veb-sayt",
  REFERRAL: "Tavsiya",
  SOCIAL_MEDIA: "Ijtimoiy tarmoq",
  WALK_IN: "Bevosita tashrif",
  OTHER: "Boshqa",
};

export const SOURCE_ORDER: LeadSource[] = ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "OTHER"];

export const ACTIVITY_LABEL: Record<LeadActivityType, string> = {
  CALL: "Qo'ng'iroq",
  MESSAGE: "Xabar",
  MEETING: "Uchrashuv",
  TRIAL_DAY: "Sinov kuni",
  STAGE_CHANGE: "Bosqich o'zgardi",
  NOTE: "Eslatma",
};
