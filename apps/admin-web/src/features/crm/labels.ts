import type { AgeGroup, LeadActivityType, LeadSource, LeadStage } from "@/lib/types";

/** `useTranslations("crm")` natijasi — bu fayl React komponenti emas, shuning
 * uchun tarjimon tashqaridan (chaqiruvchi komponentdan) uzatiladi. */
type Translator = (key: string) => string;

export function stageLabel(t: Translator, stage: LeadStage): string {
  const map: Record<LeadStage, string> = {
    NEW: t("stage.new"),
    TRIAL_DAY_SCHEDULED: t("stage.trialDayScheduled"),
    CONTRACT: t("stage.contract"),
    WON: t("stage.won"),
    LOST: t("stage.lost"),
  };
  return map[stage];
}

export const STAGE_TONE: Record<LeadStage, "primary" | "warning" | "success" | "danger"> = {
  NEW: "primary",
  TRIAL_DAY_SCHEDULED: "warning",
  CONTRACT: "primary",
  WON: "success",
  LOST: "danger",
};

export const STAGE_ORDER: LeadStage[] = ["NEW", "TRIAL_DAY_SCHEDULED", "CONTRACT", "WON", "LOST"];

export function ageGroupLabel(t: Translator, ageGroup: AgeGroup): string {
  const map: Record<AgeGroup, string> = {
    AGE_1_2: t("ageGroup.age12"),
    AGE_2_3: t("ageGroup.age23"),
    AGE_3_4: t("ageGroup.age34"),
    AGE_4_5: t("ageGroup.age45"),
    AGE_5_6: t("ageGroup.age56"),
    AGE_6_7: t("ageGroup.age67"),
  };
  return map[ageGroup];
}

export function sourceLabel(t: Translator, source: LeadSource): string {
  const map: Record<LeadSource, string> = {
    WEBSITE: t("source.website"),
    REFERRAL: t("source.referral"),
    SOCIAL_MEDIA: t("source.socialMedia"),
    WALK_IN: t("source.walkIn"),
    OTHER: t("source.other"),
  };
  return map[source];
}

export const SOURCE_ORDER: LeadSource[] = ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "OTHER"];

export function activityLabel(t: Translator, type: LeadActivityType): string {
  const map: Record<LeadActivityType, string> = {
    CALL: t("activity.call"),
    MESSAGE: t("activity.message"),
    MEETING: t("activity.meeting"),
    TRIAL_DAY: t("activity.trialDay"),
    STAGE_CHANGE: t("activity.stageChange"),
    NOTE: t("activity.note"),
  };
  return map[type];
}
