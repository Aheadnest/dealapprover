import sharp from "sharp";

interface ProcessedImage {
  full: Buffer;
  thumb320: Buffer;
  thumb800: Buffer;
  width: number;
  height: number;
}

export async function processPhoto(input: Buffer): Promise<ProcessedImage> {
  // Strip EXIF + auto-rotate based on EXIF orientation
  const baseImage = sharp(input).rotate().withMetadata({ exif: {} });

  const fullBuf = await baseImage.clone().jpeg({ quality: 88 }).toBuffer();
  const meta = await sharp(fullBuf).metadata();

  const thumb320 = await sharp(fullBuf).resize(320, 320, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
  const thumb800 = await sharp(fullBuf).resize(800, 800, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();

  return {
    full: fullBuf,
    thumb320,
    thumb800,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
