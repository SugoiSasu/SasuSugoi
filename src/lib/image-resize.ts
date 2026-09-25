/**
 * Resizes an image file to an exact target size (cover-fit crop, like CSS
 * object-cover) and re-encodes it as WebP to keep uploads small without a
 * visible quality hit. Falls back to JPEG if the browser can't produce WebP.
 */
export async function resizeImageCover(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality = 0.85,
): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.max(targetWidth / bitmap.width, targetHeight / bitmap.height);
    const srcW = targetWidth / scale;
    const srcH = targetHeight / scale;
    const srcX = (bitmap.width - srcW) / 2;
    const srcY = (bitmap.height - srcH) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas niedostępny w tej przeglądarce");
    ctx.drawImage(bitmap, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);

    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.size > 0) {
      return { blob: webp, ext: "webp", width: targetWidth, height: targetHeight };
    }
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!jpeg) throw new Error("Nie udało się przetworzyć obrazu");
    return { blob: jpeg, ext: "jpg", width: targetWidth, height: targetHeight };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Skaluje obraz tak, zeby zmiescil sie w ramce maxW x maxH, ZACHOWUJAC
 * proporcje i nigdy nie powiekszajac. Uzywane do zdjec w recenzjach: kadr
 * jedzenia nie moze byc przyciety do stalego formatu tak jak okladka lokalu.
 * Wynik to zawsze WebP (albo JPEG, gdy przegladarka nie umie WebP) - dzieki
 * temu plik trafia do kubelka w formacie, ktory ten akceptuje, niezaleznie
 * od tego, co wybral uzytkownik (np. HEIC z iPhone'a).
 */
export async function resizeImageContain(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85,
): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas niedostępny w tej przeglądarce");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.size > 0) return { blob: webp, ext: "webp", width: w, height: h };
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!jpeg) throw new Error("Nie udało się przetworzyć obrazu");
    return { blob: jpeg, ext: "jpg", width: w, height: h };
  } finally {
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  // Very old browsers: fall back to <img> + a bitmap-shaped wrapper.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Nie udało się wczytać obrazu"));
      img.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, close: () => {} } as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
