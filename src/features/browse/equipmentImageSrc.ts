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
  if (/^photo-[a-z0-9-]+$/i.test(img)) {
    return `https://images.unsplash.com/${img}?w=${w}&h=${h}&fit=crop&auto=format`;
  }
  return null;
}
