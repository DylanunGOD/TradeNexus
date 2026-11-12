"use server";

import { refresh } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado, texto } from "@/lib/acciones";
import type { EstadoAccion } from "@/lib/tipos";

async function rpc(nombre: string, args: Record<string, unknown>, ok?: string): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc(nombre, args);
  if (!error) refresh();
  return resultado(error, ok);
}

// --- Vendedor: armar el pedido -------------------------------------------
export async function agregarItem(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const publicacionId = Number(texto(fd, "publicacion_id")) || null;
  let descripcion = texto(fd, "descripcion");
  let precio = Number(texto(fd, "precio_unitario"));

  if (publicacionId) {
    const { data: p } = await supabase.from("publicaciones").select("nombre, precio").eq("id", publicacionId).single();
    if (p) {
      descripcion ||= p.nombre;
      if (!texto(fd, "precio_unitario")) precio = Number(p.precio);
    }
  }
  if (!descripcion) return { error: "Escribe la descripción del artículo o elige una publicación." };
  if (!(precio >= 0)) return { error: "Indica el precio unitario." };

  const { error } = await supabase.from("pedido_items").insert({
    pedido_id: pedidoId,
    publicacion_id: publicacionId,
    descripcion,
    cantidad: Math.max(1, Number(texto(fd, "cantidad")) || 1),
    precio_unitario: precio,
  });
  if (!error) refresh();
  return resultado(error, "Artículo agregado.");
}

export async function eliminarItem(itemId: number): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("pedido_items").delete().eq("id", itemId);
  if (!error) refresh();
  return resultado(error);
}

export async function confirmarPedido(pedidoId: number): Promise<EstadoAccion> {
  return rpc("confirmar_pedido", { p_pedido: pedidoId });
}

// --- Pago -----------------------------------------------------------------
export async function registrarComprobante(pedidoId: number, path: string): Promise<EstadoAccion> {
  return rpc("registrar_comprobante", { p_pedido: pedidoId, p_path: path });
}

export async function revisarPago(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const aprobado = fd.get("decision") === "aprobar";
  return rpc("revisar_pago", { p_pedido: pedidoId, p_aprobado: aprobado, p_motivo: texto(fd, "motivo") || null });
}

export async function cancelarPedido(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return rpc("cancelar_pedido", { p_pedido: pedidoId, p_motivo: texto(fd, "motivo") });
}

// --- Calificación (RF-11) ---------------------------------------------------
export async function calificarVendedor(pedidoId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const estrellas = Number(fd.get("estrellas"));
  if (!(estrellas >= 1 && estrellas <= 5)) return { error: "Elige de 1 a 5 estrellas." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("calificaciones")
    .insert({ pedido_id: pedidoId, estrellas, comentario: texto(fd, "comentario") || null });
  if (!error) refresh();
  return resultado(error, "¡Gracias por calificar!");
}
