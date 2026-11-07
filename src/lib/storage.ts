/** URL pública de un archivo en un bucket público (publicaciones, avatars). */
export function urlPublica(bucket: "publicaciones" | "avatars", path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Nombre de archivo único y seguro para subir a Storage. */
export function nombreArchivo(original: string, extension?: string) {
  const ext = (extension ?? original.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
