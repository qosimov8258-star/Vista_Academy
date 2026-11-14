/**
 * O'yin tovushlari brauzerning o'zida (Web Audio) yasaladi — audio fayl
 * yuklanmaydi. Ovoz past va yumshoq: telefon karnayida ham quloqqa urmaydi.
 * AudioContext birinchi bosishdan keyin yaratiladi (brauzerlar shuni talab
 * qiladi).
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, delay: number, duration: number, type: OscillatorType = "sine", volume = 0.14) {
  const c = audio();
  if (!c) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

export const sfx = {
  /** Karta ochildi — qisqa «chirt» */
  flip: () => tone(700, 0, 0.07, "triangle", 0.07),
  /** Juft topildi — ikki notali qo'ng'iroqcha */
  match: () => {
    tone(784, 0, 0.2);
    tone(1175, 0.09, 0.32);
  },
  /** Mos kelmadi — past, mayin, «xato» emas, «yana urinib ko'r» */
  miss: () => {
    tone(392, 0, 0.16, "sine", 0.06);
    tone(330, 0.11, 0.2, "sine", 0.06);
  },
  /** G'alaba — ko'tariluvchi kuy */
  win: () => [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, i * 0.11, i === 4 ? 0.55 : 0.28, "triangle", 0.1)),
};

/** Android'da yengil titrash; iPhone Safari qo'llamaydi — jim o'tadi */
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // qo'llanmaydi
  }
}

/* ------------------------------------------------------------------------ */
/* Ovoz yozuvlari («Kim qichqirdi?»)                                          */
/* ------------------------------------------------------------------------ */

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;

/**
 * Brauzer ovozga ruxsat berishi uchun bosish ichida chaqiriladi (iPhone
 * Safari AudioContext'ni faqat foydalanuvchi bosganda yoqadi).
 */
export function unlockAudio(): boolean {
  // iPhone'da Web Audio «jim» tugmasi yoqilgan bo'lsa eshitilmaydi. Bu o'yinda
  // ovoz — o'yinning o'zi, shuning uchun iOS 17+ da ijro rejimiga o'tamiz
  // (eski qurilmalarda bu xususiyat yo'q — jim o'tadi).
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    // qo'llanmaydi
  }
  return !!audio();
}

/** Ovoz holati: `running` — ijro etsa bo'ladi; aks holda avval bosish kerak */
export function audioReady(): boolean {
  return ctx?.state === "running";
}

/** Yozuvni oldindan yuklab, ochib qo'yadi — bosilganda kechikmasin */
export function loadClip(url: string): Promise<AudioBuffer | null> {
  let pending = buffers.get(url);
  if (!pending) {
    const c = audio();
    pending = c
      ? fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
          .then((data) => c.decodeAudioData(data))
          .catch(() => {
            buffers.delete(url); // keyingi safar qayta urinib ko'radi
            return null;
          })
      : Promise.resolve(null);
    buffers.set(url, pending);
  }
  return pending;
}

/**
 * Yozuvni ijro etadi; avvalgisi to'xtatiladi (ovozlar ustma-ust tushmaydi).
 * Ijro tugaganda (yoki ijro etib bo'lmasa) promise bajariladi; qaytgan
 * qiymat — yozuv uzunligi, soniyada (0 — ijro etilmadi).
 */
export async function playClip(url: string): Promise<number> {
  const c = audio();
  const buffer = await loadClip(url);
  if (!c || !buffer) return 0;
  stopClip();
  const source = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = 0.9;
  source.buffer = buffer;
  source.connect(gain).connect(c.destination);
  current = source;
  return new Promise((resolve) => {
    source.onended = () => {
      if (current === source) current = null;
      resolve(buffer.duration);
    };
    source.start();
  });
}

export function stopClip() {
  if (!current) return;
  try {
    current.onended = null;
    current.stop();
  } catch {
    // allaqachon tugagan
  }
  current = null;
}
