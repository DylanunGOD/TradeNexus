"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

/** Abre (o reutiliza) la conversación con el vendedor y lleva al chat. */
export async function contactarVendedor(vendedorId: string, publicacionId: number): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("iniciar_conversacion", { p_vendedor: vendedorId, p_publicacion: publicacionId });
  if (error) return resultado(error);
  redirect(`/mensajes/${data}`);
}
