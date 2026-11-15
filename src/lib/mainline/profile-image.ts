type ImageKind = "avatar" | "banner";

const IMAGE_SETTINGS: Record<ImageKind, { width: number; height: number; maxBytes: number }> = {
  avatar: { width: 512, height: 512, maxBytes: 180_000 },
  banner: { width: 1600, height: 560, maxBytes: 420_000 },
};

export async function prepareProfileImage(file: File, kind: ImageKind): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 10 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image could not be opened. Try another file.");
  }

  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("Choose an image with smaller dimensions.");
    }
    const settings = IMAGE_SETTINGS[kind];
    const canvas = document.createElement("canvas");
    canvas.width = settings.width;
    canvas.height = settings.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image editing is unavailable in this browser.");

    const scale = Math.max(settings.width / bitmap.width, settings.height / bitmap.height);
    const sourceWidth = settings.width / scale;
    const sourceHeight = settings.height / scale;
    const sourceX = (bitmap.width - sourceWidth) / 2;
    const sourceY = (bitmap.height - sourceHeight) / 2;
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      settings.width,
      settings.height,
    );

    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= settings.maxBytes) return await blobDataUrl(blob);
    }
    throw new Error("This image is too detailed to upload. Try a simpler image.");
  } finally {
    bitmap.close();
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare this image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not prepare this image."));
    };
    reader.onerror = () => reject(new Error("Could not prepare this image."));
    reader.readAsDataURL(blob);
  });
}
