/**
 * Extracts a vibrant accent color from a wallpaper image using canvas sampling.
 * Returns an oklch CSS string, falling back to a neutral blue if extraction fails.
 */
export async function extractWallpaperColor(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 40;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(FALLBACK_COLOR);

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;
          if (a < 200) continue;

          const score = vibrance(r, g, b);
          if (score > bestScore) {
            bestScore = score;
            bestR = r; bestG = g; bestB = b;
          }
        }

        if (bestScore < 0) return resolve(FALLBACK_COLOR);
        resolve(rgbToOklch(bestR, bestG, bestB));
      } catch {
        resolve(FALLBACK_COLOR);
      }
    };

    img.onerror = () => resolve(FALLBACK_COLOR);
    img.src = src;
  });
}

const FALLBACK_COLOR = "oklch(0.65 0.2 250)";

/** Scores how vivid/saturated a pixel is, penalising near-black and near-white. */
function vibrance(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  // Penalise very dark (<40) and very light (>215) pixels
  if (lightness < 40 || lightness > 215) return -1;
  return chroma;
}

/** Converts sRGB [0-255] to an approximate oklch() string. */
function rgbToOklch(r: number, g: number, b: number): string {
  // linearise
  const lr = linearise(r / 255);
  const lg = linearise(g / 255);
  const lb = linearise(b / 255);

  // sRGB → XYZ (D65)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // XYZ → Oklab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bk * bk);
  const h = (Math.atan2(bk, a) * 180) / Math.PI;
  const hue = h < 0 ? h + 360 : h;

  const lPct = Math.round(L * 100) / 100;
  const cRounded = Math.round(C * 1000) / 1000;
  const hRounded = Math.round(hue);

  return `oklch(${lPct} ${cRounded} ${hRounded})`;
}

function linearise(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
