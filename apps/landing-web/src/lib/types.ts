export type LandingScheduleType = "LESSON" | "SLEEP" | "MEAL" | "OTHER";

export interface LandingScheduleItem {
  id: string;
  time: string;
  title: string;
  type: LandingScheduleType;
}

export type LandingMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER" | "OTHER";

export type LandingWeekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface LandingMeal {
  id: string;
  title: string;
  description: string | null;
  mealType: LandingMealType;
  weekday: LandingWeekday | null;
  time: string | null;
  photoPath: string | null;
}

export interface LandingTeacher {
  id: string;
  fullName: string;
  role: string;
  bio: string | null;
  photoPath: string | null;
}

export interface LandingContentBlock {
  key: string;
  title: string;
  body: string;
  photoPath: string | null;
}
