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
