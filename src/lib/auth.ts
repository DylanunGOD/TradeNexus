import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "./supabase/server";
import type { Perfil, Rol } from "./tipos";

export interface Usuario {
  id: string;
  email: string;
  perfil: Perfil;
}

/**
 * Devuelve el usuario con sesión iniciada (o null). `cache` evita repetir
 * la consulta si varios componentes la piden en la misma solicitud.
 */
export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", claims.sub).single();
  if (!perfil) return null;
  return { id: claims.sub, email: String(claims.email ?? ""), perfil: perfil as Perfil };
});

/** Exige sesión (y opcionalmente uno de los roles indicados). */
export async function exigirUsuario(roles?: Rol[]): Promise<Usuario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  if (roles && !roles.includes(usuario.perfil.rol)) redirect("/?aviso=sin-permiso");
  return usuario;
}
