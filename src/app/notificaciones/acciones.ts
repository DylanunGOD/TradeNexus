"use server";

import { refresh } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

export async function marcarTodasLeidas(): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("marcar_notificaciones_leidas");
  if (!error) refresh();
  return resultado(error);
}
