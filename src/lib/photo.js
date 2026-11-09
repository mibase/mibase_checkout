// Shrinks a camera photo and re-encodes it as JPEG before upload. Drawing to a
// canvas drops EXIF data (including GPS location) and keeps uploads small on
// mobile data. The server re-encodes again (research R8).
export async function resizeToJpeg(file, maxSide = 1600, quality = 0.8) {
  const source = await loadImage(file);
  const { width, height } = source;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't read that photo. Please take it again.");
  return blob;
}

async function loadImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Please take a photo of the toy.");
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
