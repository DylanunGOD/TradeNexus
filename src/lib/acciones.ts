import type { PostgrestError } from "@supabase/supabase-js";
import type { EstadoAccion } from "./tipos";

/**
 * Convierte un error de Supabase en un mensaje legible. Los errores que
 * lanzan nuestras funciones SQL (raise exception) ya vienen en español.
 */
export function resultado(error: PostgrestError | { message: string } | null, ok?: string): EstadoAccion {
  if (!error) return { ok };
  const m = error.message;
  if (/row-level security|permission denied/i.test(m)) return { error: "No tienes permiso para realizar esta acción." };
  if (/duplicate key/i.test(m)) return { error: "Ese registro ya existe." };
  return { error: m };
}

export const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
