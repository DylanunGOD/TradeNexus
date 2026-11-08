"use server";

import { refresh } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

/** Retira o vuelve a publicar una publicación (RF-04). */
export async function cambiarEstadoPublicacion(id: number, estado: "activa" | "retirada"): Promise<EstadoAccion> {
  await exigirUsuario(["vendedor"]);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("publicaciones").update({ estado }).eq("id", id);
  if (!error) refresh();
  return resultado(error);
}
