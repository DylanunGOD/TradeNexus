import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/**
 * Cliente de Supabase para Server Components y Server Actions.
 * Usa la sesión guardada en cookies, así que todas las consultas
 * respetan las políticas RLS del usuario que está navegando.
 *
 * `connection()` hace que todo lo que usa la sesión se genere al recibir
 * la solicitud y no durante el prerender: Supabase revisa la hora para
 * saber si la sesión venció, y Next (Cache Components) no permite leer
 * la hora mientras prerenderiza.
 */
export async function crearClienteServidor() {
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: el proxy (src/proxy.ts) ya
            // se encarga de refrescar la sesión, así que se puede ignorar.
          }
        },
      },
    },
  );
}
