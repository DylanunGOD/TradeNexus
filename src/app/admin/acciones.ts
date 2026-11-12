"use server";

import { refresh } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado, texto } from "@/lib/acciones";
import type { EstadoAccion, Rol } from "@/lib/tipos";

/** Registro interno de strikes (RF-13, HU-19). */
export async function registrarStrike(_: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { id } = await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("strikes").insert({
    vendedor_id: texto(fd, "vendedor_id"),
    admin_id: id,
    denuncia_id: Number(texto(fd, "denuncia_id")) || null,
    motivo: texto(fd, "motivo"),
  });
  if (!error) refresh();
  return resultado(error, "Strike registrado.");
}

/** Asigna rol y tienda a un usuario (RT-03). */
export async function asignarRol(usuarioId: string, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("asignar_rol", {
    p_usuario: usuarioId,
    p_rol: texto(fd, "rol") as Rol,
    p_tienda: Number(texto(fd, "tienda_id")) || null,
  });
  if (!error) refresh();
  return resultado(error, "Guardado.");
}

/** Crea o actualiza una tienda de la red (RT-02). */
export async function guardarTienda(tiendaId: number | null, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await exigirUsuario(["admin"]);
  const datos = {
    nombre: texto(fd, "nombre"),
    provincia: texto(fd, "provincia"),
    direccion: texto(fd, "direccion"),
    horario: texto(fd, "horario") || null,
    telefono: texto(fd, "telefono") || null,
    dias_despacho: fd.getAll("dias_despacho").map(Number),
    es_punto_retiro: fd.get("es_punto_retiro") === "on",
    activa: fd.get("activa") === "on",
    lat: Number(texto(fd, "lat")) || null,
    lng: Number(texto(fd, "lng")) || null,
  };
  if (!datos.nombre || !datos.provincia) return { error: "El nombre y la provincia son obligatorios." };
  const supabase = await crearClienteServidor();
  const { error } = tiendaId
    ? await supabase.from("tiendas").update(datos).eq("id", tiendaId)
    : await supabase.from("tiendas").insert(datos);
  if (!error) refresh();
  return resultado(error, "Tienda guardada.");
}

/** El admin puede ajustar la relevancia en el meta de cualquier publicación (RF-03). */
export async function ajustarMeta(publicacionId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("publicaciones").update({ relevancia_meta: Number(fd.get("relevancia_meta")) }).eq("id", publicacionId);
  if (!error) refresh();
  return resultado(error, "✓");
}
