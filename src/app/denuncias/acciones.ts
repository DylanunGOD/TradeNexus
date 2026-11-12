"use server";

import { refresh } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { resultado, texto } from "@/lib/acciones";
import type { EstadoAccion, EstadoDenuncia } from "@/lib/tipos";

export async function comentarDenuncia(denunciaId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const contenido = texto(fd, "contenido");
  if (!contenido) return { error: "Escribe un comentario." };
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase.from("denuncia_comentarios").insert({ denuncia_id: denunciaId, autor_id: data?.claims.sub, contenido });
  if (!error) refresh();
  return resultado(error, "Comentario enviado.");
}

/** Soporte cambia el estado y registra la resolución (HU-18). */
export async function gestionarDenuncia(denunciaId: number, _: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("gestionar_denuncia", {
    p_denuncia: denunciaId,
    p_estado: texto(fd, "estado") as EstadoDenuncia,
    p_resolucion: texto(fd, "resolucion") || null,
  });
  if (!error) refresh();
  return resultado(error, "Denuncia actualizada.");
}
