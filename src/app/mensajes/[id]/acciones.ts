"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

/** El comprador crea un pedido vacío; el vendedor lo llenará (criterio de aceptación). */
export async function crearPedido(conversacionId: number): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_pedido", { p_conversacion: conversacionId });
  if (error) return resultado(error);
  redirect(`/pedidos/${data}`);
}
