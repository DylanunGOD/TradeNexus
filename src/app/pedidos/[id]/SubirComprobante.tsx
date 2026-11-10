"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/imagenes";
import { nombreArchivo } from "@/lib/storage";
import { registrarComprobante } from "./acciones";

const PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** El comprador adjunta el comprobante del pago externo (RN-03, HU-08). */
export function SubirComprobante({ pedidoId }: { pedidoId: number }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    if (!PERMITIDOS.includes(archivo.type)) return setError("Sube una imagen (JPG, PNG, WebP) o un PDF.");
    if (archivo.size > 10 * 1024 * 1024) return setError("El archivo es demasiado grande (máximo 10 MB).");
    setEnviando(true);
    setError("");
    const supabase = crearClienteNavegador();
    const esPdf = archivo.type === "application/pdf";
    const cuerpo = esPdf ? archivo : await comprimirImagen(archivo, 1600, 0.85);
    const path = `${pedidoId}/${nombreArchivo(archivo.name, esPdf ? "pdf" : "webp")}`;
    const { error: e1 } = await supabase.storage
      .from("comprobantes")
      .upload(path, cuerpo, { contentType: esPdf ? "application/pdf" : "image/webp" });
    if (e1) {
      setEnviando(false);
      return setError("No se pudo subir el archivo: " + e1.message);
    }
    const r = await registrarComprobante(pedidoId, path);
    setEnviando(false);
    if (r.error) setError(r.error);
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-borde px-4 py-6 text-center text-sm hover:border-marca">
        <span className="text-2xl" aria-hidden>
          🧾
        </span>
        <span className="font-medium">{archivo ? archivo.name : "Elegir comprobante (foto o PDF)"}</span>
        <span className="text-xs text-texto-suave">Solo tú y el vendedor podrán verlo.</span>
        <input type="file" accept={PERMITIDOS.join(",")} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="sr-only" />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primario w-full" disabled={!archivo || enviando}>
        {enviando ? "Enviando…" : "Enviar comprobante"}
      </button>
    </form>
  );
}
