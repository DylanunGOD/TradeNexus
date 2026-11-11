"use server";

import { refresh } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado, texto } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

/**
 * Acciones de logística (RF-7). Cada una llama a una función SQL que
 * verifica que el usuario sea personal de la tienda correcta (o admin)
 * y que el pedido esté en el estado esperado.
 */
async function rpc(nombre: string, args: Record<string, unknown>, ok: string): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc(nombre, args);
  if (!error) refresh();
  return resultado(error, ok);
}

export async function recibirEnOrigen(pedidoId: number): Promise<EstadoAccion> {
  return rpc("recibir_en_origen", { p_pedido: pedidoId }, "Recepción registrada.");
}

export async function despacharPedido(pedidoId: number): Promise<EstadoAccion> {
  return rpc("despachar_pedido", { p_pedido: pedidoId }, "Despacho registrado.");
}

export async function recibirEnNodo(pedidoId: number): Promise<EstadoAccion> {
  return rpc("recibir_en_nodo", { p_pedido: pedidoId }, "Llegada registrada.");
}

export async function confirmarRetiro(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const codigo = texto(fd, "codigo").replace(/\D/g, "");
  if (codigo.length !== 6) return { error: "El código tiene 6 dígitos." };
  return rpc("confirmar_retiro", { p_pedido: pedidoId, p_codigo: codigo }, "¡Pedido entregado!");
}

export async function definirRuta(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const paradas = fd.getAll("paradas").map(Number).filter(Boolean);
  return rpc("definir_ruta", { p_pedido: pedidoId, p_paradas: paradas }, "Ruta actualizada.");
}
