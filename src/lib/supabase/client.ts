import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Client Components (navegador).
 * Se usa para el chat en tiempo real, la campana de notificaciones y
 * para subir archivos directamente a Storage.
 */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
