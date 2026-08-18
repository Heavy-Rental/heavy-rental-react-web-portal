// Shape-validates an Asset.img value as a bare Unsplash photo id (e.g. "photo-<id>") —
// anything else (a stray/oversized string, a data: URI missing its prefix, a raw base64
// blob) must not be concatenated onto the images.unsplash.com path, since that produces a
// malformed request (414 URI Too Long / 502 from Unsplash's edge) instead of a normal 404.
export function isUnsplashPhotoId(img: string): boolean {
  return /^photo-[a-z0-9-]+$/i.test(img);
}

export function equipmentImageSrc(
  img: string | undefined,
  w: number,
  h: number,
): string | null {
  if (!img) return null;
  if (img.startsWith("data:") || img.startsWith("http://") || img.startsWith("https://")) {
    return img;
  }
  // Mock catalog stores Unsplash photo ids; Spring may send a non-URL placeholder.
  if (isUnsplashPhotoId(img)) {
    return `https://images.unsplash.com/${img}?w=${w}&h=${h}&fit=crop&auto=format`;
  }
  return null;
}
