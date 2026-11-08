"use server";

import { refresh } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado, texto } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

export async function guardarPerfil(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { id, perfil } = await exigirUsuario();
  const nombre = texto(fd, "nombre");
  if (nombre.length < 2) return { error: "Escribe tu nombre." };

  const cambios: Record<string, unknown> = { nombre };
  if (perfil.rol === "comprador") cambios.tienda_preferida_id = Number(texto(fd, "tienda_preferida_id")) || null;
  if (perfil.rol === "vendedor") {
    cambios.tienda_id = Number(texto(fd, "tienda_id")) || null;
    cambios.bio = texto(fd, "bio") || null;
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update(cambios).eq("id", id);
  if (!error) refresh();
  return resultado(error, "Cambios guardados.");
}
