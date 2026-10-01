import sharp from "sharp";

/**
 * Yuz rasmini terminal qabul qiladigan hajmga keltiradi: JPEG, ≤ maxBytes.
 * Avval sifat, keyin o'lcham kamaytiriladi. Agent (bitta faylli zeeron-agent)
 * ichida sharp yo'q — shuning uchun bu ish serverda bajariladi.
 */
export async function fitFaceJpeg(input: Buffer, maxBytes: number): Promise<Buffer> {
  const isJpeg = input.byteLength > 3 && input[0] === 0xff && input[1] === 0xd8;
  if (isJpeg && input.byteLength <= maxBytes) return input;
  let size = 640;
  let quality = 85;
  for (let i = 0; i < 12; i++) {
    const out = await sharp(input)
      .rotate()
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.byteLength <= maxBytes) return out;
    if (quality > 55) quality -= 10;
    else size = Math.round(size * 0.8);
  }
  throw new Error(`Rasmni ${maxBytes} baytgacha kichraytirib bo'lmadi`);
}
