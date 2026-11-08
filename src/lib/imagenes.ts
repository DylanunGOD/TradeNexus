/**
 * Comprime una imagen en el navegador antes de subirla: la reduce a un
 * lado máximo de `maxLado` píxeles y la convierte a WebP. Así cada foto
 * pesa ~100-300 KB y el plan gratuito de Storage rinde mucho más.
 */
export async function comprimirImagen(archivo: File, maxLado = 1280, calidad = 0.82): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) return archivo;
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", calidad));
  return blob ?? archivo;
}

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
export const MAX_MB = 10;
