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
        let ciemne = 0;
        for (let p = 0, i = 0; i < data.length; i += 4, p++) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = alphas[p];
          if (alpha > 128) {
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            lumSum += lum;
            lumCount++;
            if (lum < 110) ciemne++;
          }
        }

        // A pale/white logo mark (background just cut) would be near-invisible
        // on the white card behind it - force it to a dark, readable silhouette.
        // Tylko logo naprawde biale BEZ ciemnych elementow (np. kremowy napis,
        // ktoremu wycielismy ciemna plakietke). Stary prog (srednia > 190)
        // przy wycinaniu od krawedzi lapal jasne logo z ciemnymi konturami -
        // GEMUSE SPOT wychodzilo jako czarna sylwetka (zrzut 2026-09-28).
        // Przyciemniamy tylko przypadek, dla ktorego to istnieje: jasny znak
        // na CIEMNEJ plakietce (Parabar), ktorej tlo wlasnie wycielismy - na
        // bialej karcie zostalby niewidoczny. Logo z jasnym tlem (GEMUSE SPOT)
        // nie jest ruszane - prog "srednia jasnosc > 190" robil z niego czarna
        // sylwetke (zrzut 2026-09-28).
        const avgLum = lumCount ? lumSum / lumCount : 0;
        const bgLum = 0.2126 * br + 0.7152 * bg + 0.0722 * bb;
        const tooLightForWhiteCard = bgLum < 90 && avgLum > 170 && ciemne / Math.max(1, lumCount) < 0.1;
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
 * Logo, ktore po wycieciu tla nadal jest prostokatem lub kwadratem (bialy
 * plakat Kuchni Piatkowskiej, czarny kwadrat Smasznego Teja, bordowy The Round).
 * Takie logo rozni sie od okraglych i psuje spojnosc, wiec pokazujemy je w kole
 * w kolorze wlasnego tla. Rozpoznanie: nieprzezroczysta czesc wypelnia prawie
 * caly swoj prostokat (kolo wypelnia ~78%, sam napis duzo mniej), a kolor
 * srodkow czterech krawedzi jest wspolny - inaczej (np. ikona z wzorem) nie
 * dobierzemy koloru koła i zostawiamy logo jak jest.
 */
export type Kafel = { kafel: boolean; kolor: string };
const BRAK_KAFLA: Kafel = { kafel: false, kolor: "transparent" };
const kaflaCache = new Map<string, Promise<Kafel>>();

function analizaKafla(src: string): Promise<Kafel> {
  const cached = kaflaCache.get(src);
  if (cached) return cached;
  const p = new Promise<Kafel>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const skala = Math.min(1, 128 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * skala));
        const h = Math.max(1, Math.round(img.naturalHeight * skala));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(BRAK_KAFLA);
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] > 200) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 < 0) return resolve(BRAK_KAFLA);
        const bw = x1 - x0 + 1;
        const bh = y1 - y0 + 1;
        let pelne = 0;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) if (d[(y * w + x) * 4 + 3] > 200) pelne++;
        }
        const wypelnienie = pelne / (bw * bh);
        const zajecie = (bw * bh) / (w * h);
        if (wypelnienie < 0.93 || zajecie < 0.2) return resolve(BRAK_KAFLA);
        const px = (x: number, y: number) => {
          const i = (y * w + x) * 4;
          return [d[i], d[i + 1], d[i + 2]];
        };
        const mx = Math.round((x0 + x1) / 2);
        const my = Math.round((y0 + y1) / 2);
        const probki = [px(mx, y0 + 1), px(mx, y1 - 1), px(x0 + 1, my), px(x1 - 1, my)];
        const sr = [0, 1, 2].map((k) => probki.reduce((s, p) => s + p[k], 0) / 4);
        const spojny = probki.every((p) => Math.hypot(p[0] - sr[0], p[1] - sr[1], p[2] - sr[2]) < 40);
        if (!spojny) return resolve(BRAK_KAFLA);
        resolve({ kafel: true, kolor: `rgb(${sr.map(Math.round).join(",")})` });
      } catch {
        resolve(BRAK_KAFLA);
      }
    };
    img.onerror = () => resolve(BRAK_KAFLA);
    img.src = src;
  });
  kaflaCache.set(src, p);
  return p;
}

type StanLogo = { src: string | null; gotowe: boolean } & Kafel;

/**
 * Jak useCutoutLogo, ale mowi tez, czy wynik jest juz ostateczny. Karty
 * pokazuja logo dopiero wtedy - inaczej najpierw widac oryginal z tlem, a po
 * chwili podmienia sie wyciety (logo "mrugalo"). Dodatkowo: czy logo jest
 * "kaflem" (prostokat/kwadrat) i jakiego koloru, zeby pokazac je w kole.
 */
export function useCutoutLogoReady(url: string | null | undefined, wytnij = true): StanLogo {
  const [stan, setStan] = useState<StanLogo>({ src: null, gotowe: !url, ...BRAK_KAFLA });
  useEffect(() => {
    if (!url) {
      setStan({ src: null, gotowe: true, ...BRAK_KAFLA });
      return;
    }
    let cancelled = false;
    setStan({ src: null, gotowe: false, ...BRAK_KAFLA });
    // Wycinanie moze byc wylaczone dla lokalu (tlo jest czescia znaku), ale
    // ksztalt loga nadal sprawdzamy - stad osobny krok.
    (wytnij ? cutoutBackground(url) : Promise.resolve(url))
      .then(async (blobUrl) => {
        const k = await analizaKafla(blobUrl);
        if (!cancelled) setStan({ src: blobUrl, gotowe: true, ...k });
      })
      // Wycinanie nie wyszlo (CORS, zly plik) - pokazujemy oryginal.
      .catch(() => !cancelled && setStan({ src: url, gotowe: true, ...BRAK_KAFLA }));
    return () => {
      cancelled = true;
    };
  }, [url, wytnij]);
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
