/**
 * Ota-onaning kabinetdan yuboradigan xabarlari — tarbiyachilarga xodim
 * bildirishnomasi (`EmployeeNotification.message`) sifatida yoziladi.
 *
 * Matn qolipi shu yerda bitta joyda: yozuvchi (`ParentService`) ham,
 * adminlar uchun o'quvchi (`EmployeeNotificationsService.parentMessages`) ham
 * shu funksiyalardan foydalanadi — biri o'zgarsa ikkinchisi ham birga o'zgaradi.
 * Jadvalda alohida «manba» ustuni yo'q, shuning uchun ota-ona xabari boshqa
 * bildirishnomalardan (masalan dars jadvali) aynan shu qolip bo'yicha ajratiladi.
 */

/** Bolaga qarindoshligi: "onasi" / "otasi" / "ota-onasi" */
export type GuardianWord = "onasi" | "otasi" | "ota-onasi";

export function departureMessage(childName: string, who: GuardianWord, parentName: string, minutes: number): string {
  return `${childName}ning ${who} ${parentName} yo'lga chiqdi — taxminan ${minutes} daqiqada yetib keladi. Bolani tayyorlab qo'ying.`;
}

export function noteMessage(childName: string, who: GuardianWord, parentName: string, text: string): string {
  return `${childName} ${who}dan (${parentName}) eslatma: ${text.trim()}`;
}

export type ParsedParentMessage =
  | { kind: "NOTE"; childName: string; who: GuardianWord; parentName: string; text: string }
  | { kind: "DEPARTURE"; childName: string; who: GuardianWord; parentName: string; minutes: number };

const NOTE_RE = /^(.+?) (onasi|otasi|ota-onasi)dan \((.+?)\) eslatma: ([\s\S]+)$/;
const DEPARTURE_RE = /^(.+?)ning (onasi|otasi|ota-onasi) (.+?) yo'lga chiqdi — taxminan (\d+) daqiqada yetib keladi\. Bolani tayyorlab qo'ying\.$/;

/** Bildirishnoma ota-onadan kelganmi — bo'lsa, qismlariga ajratadi; aks holda `null`. */
export function parseParentMessage(message: string): ParsedParentMessage | null {
  const departure = DEPARTURE_RE.exec(message);
  if (departure) {
    return {
      kind: "DEPARTURE",
      childName: departure[1],
      who: departure[2] as GuardianWord,
      parentName: departure[3],
      minutes: Number(departure[4]),
    };
  }
  const note = NOTE_RE.exec(message);
  if (note) {
    return { kind: "NOTE", childName: note[1], who: note[2] as GuardianWord, parentName: note[3], text: note[4] };
  }
  return null;
}
