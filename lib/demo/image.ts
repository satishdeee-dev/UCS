"use client";

/**
 * Center-crop and resize an image File into a small square JPEG Blob,
 * suitable for storing as a profile photo and broadcasting over Realtime.
 */
export async function resizeImageToJpeg(
  file: File,
  size = 256,
  quality = 0.85,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const min = Math.min(img.width, img.height);
    const sx = (img.width - min) / 2;
    const sy = (img.height - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
