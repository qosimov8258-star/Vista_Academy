/**
 * Bog'cha xodimi «Ota-ona profiliga kirish» orqali ochgan tab. Belgi faqat
 * shu tabda (sessionStorage) turadi: bu tabdagi ko'rishlar ota-onaning
 * faollik statistikasiga yozilmaydi, ota-onaning o'z qurilmasi esa ta'sirlanmaydi.
 */
const KEY = "zeeron:parent-entry";

export function markParentEntrySession() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // maxfiy rejim — belgisiz ham ishlayveradi
  }
}

export function isParentEntrySession(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
