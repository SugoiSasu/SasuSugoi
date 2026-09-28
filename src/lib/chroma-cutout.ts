import { useEffect, useState } from "react";

/**
 * Best-effort background removal for logo badges that sit on a flat,
 * near-uniform background (white/cream/black, common for uploaded place
 * logos). Samples the four corner pixels as the background color, then
 * makes near-matching pixels transparent with a soft-feathered edge.
 * Not real segmentation - a photographic or gradient background won't
 * cut out cleanly, but it's free and needs no external service.
 *
 * The card behind the cutout is always white (see index.tsx), so a pale
 * logo mark (e.g. cream text on a black plate) would survive the cutout
 * but read as near-invisible - if the surviving pixels average very light,
 * they're forced to a dark silhouette instead of losing their own colors.
 */
const cache = new Map<string, Promise<string>>();

function cutoutBackground(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;

  const promise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0);

        const { width, height } = canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const corners: Array<[number, number]> = [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1],
        ];
        let br = 0,
          bg = 0,
          bb = 0;
        for (const [x, y] of corners) {
          const i = (y * width + x) * 4;
          br += data[i];
          bg += data[i + 1];
          bb += data[i + 2];
        }
        br /= 4;
        bg /= 4;
        bb /= 4;

        // Logo, ktore juz ma przezroczyste tlo (PNG), zostawiamy w spokoju -
        // "wycinanie" tylko by je poszarpalo.
        const przezroczysteRogi = corners.filter(([x, y]) => data[(y * width + x) * 4 + 3] < 250).length;
        if (przezroczysteRogi >= 2) {
          resolve(url);
          return;
        }

        const threshold = 34;
        const feather = 26;
        const n = width * height;
        const distOf = (p: number) => {
          const i = p * 4;
          return Math.sqrt((data[i] - br) ** 2 + (data[i + 1] - bg) ** 2 + (data[i + 2] - bb) ** 2);
        };
        // Tlo = tylko obszar POLACZONY z brzegiem obrazka (flood fill od
        // krawedzi). Dawniej znikal kazdy piksel w kolorze tla, takze w srodku
        // logo - biale elementy (np. wydra Lontry) robily sie dziurami, przez
        // ktore przeswitywalo tlo karty (zrzut Mateusza 2026-09-28).
        // Rozlewamy sie tylko przez piksele wyraznie tla (< threshold); pas
        // przejsciowy (feather) dostaje czesciowa przezroczystosc, ale dalej
        // nie przepuszcza - inaczej fill wyciekalby przez antyaliasing.
        const alphas = new Float32Array(n).fill(255);
        const odwiedzone = new Uint8Array(n);
        const stos: number[] = [];
        const dodaj = (p: number) => {
          if (odwiedzone[p]) return;
          odwiedzone[p] = 1;
          const d = distOf(p);
          if (d < threshold) {
            alphas[p] = 0;
            stos.push(p);
          } else if (d < threshold + feather) {
            alphas[p] = ((d - threshold) / feather) * 255;
          }
        };
        for (let x = 0; x < width; x++) {
          dodaj(x);
          dodaj((height - 1) * width + x);
        }
        for (let y = 0; y < height; y++) {
          dodaj(y * width);
          dodaj(y * width + width - 1);
        }
        while (stos.length) {
          const p = stos.pop()!;
          const x = p % width;
          if (x > 0) dodaj(p - 1);
          if (x < width - 1) dodaj(p + 1);
          if (p >= width) dodaj(p - width);
          if (p < n - width) dodaj(p + width);
        }

        let lumSum = 0;
        let lumCount = 0;
        for (let p = 0, i = 0; i < data.length; i += 4, p++) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = alphas[p];
          if (alpha > 128) {
            lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            lumCount++;
          }
        }

        // A pale/white logo mark (background just cut) would be near-invisible
        // on the white card behind it - force it to a dark, readable silhouette.
        const avgLum = lumCount ? lumSum / lumCount : 0;
        const tooLightForWhiteCard = avgLum > 190;
        for (let p = 0, i = 0; i < data.length; i += 4, p++) {
          data[i + 3] = Math.min(data[i + 3], alphas[p]);
          if (tooLightForWhiteCard) {
            data[i] = 20;
            data[i + 1] = 22;
            data[i + 2] = 30;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("toBlob failed"));
            return;
          }
          resolve(URL.createObjectURL(blob));
        }, "image/png");
      } catch (e) {
        reject(e as Error);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });

  cache.set(url, promise);
  return promise;
}

/**
 * Jak useCutoutLogo, ale mowi tez, czy wynik jest juz ostateczny. Karty
 * pokazuja logo dopiero wtedy - inaczej najpierw widac oryginal z tlem, a po
 * chwili podmienia sie wyciety (logo "mrugalo").
 */
export function useCutoutLogoReady(url: string | null | undefined): { src: string | null; gotowe: boolean } {
  const [stan, setStan] = useState<{ src: string | null; gotowe: boolean }>({ src: null, gotowe: !url });
  useEffect(() => {
    if (!url) {
      setStan({ src: null, gotowe: true });
      return;
    }
    let cancelled = false;
    setStan({ src: null, gotowe: false });
    cutoutBackground(url)
      .then((blobUrl) => !cancelled && setStan({ src: blobUrl, gotowe: true }))
      // Wycinanie nie wyszlo (CORS, zly plik) - pokazujemy oryginal.
      .catch(() => !cancelled && setStan({ src: url, gotowe: true }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return stan;
}

/** Returns a background-cut-out blob URL once ready, or null while loading/unavailable. */
export function useCutoutLogo(url: string | null | undefined): string | null {
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setResult(null);
    cutoutBackground(url)
      .then((blobUrl) => {
        if (!cancelled) setResult(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return result;
}
