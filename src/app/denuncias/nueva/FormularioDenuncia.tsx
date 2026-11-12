"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/imagenes";
import { nombreArchivo } from "@/lib/storage";
import { MOTIVOS_DENUNCIA } from "@/lib/formato";

const PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_ARCHIVOS = 4;

/** Denuncia con evidencia adjunta (RF-12, HU-17). */
export function FormularioDenuncia({ pedidoId, compradorId }: { pedidoId: number; compradorId: string }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const descripcion = String(fd.get("descripcion")).trim();
    if (descripcion.length < 10) return setError("Describe el problema con al menos 10 caracteres.");
    setEnviando(true);
    setError("");
    const supabase = crearClienteNavegador();
    const { data: d, error: e1 } = await supabase
      .from("denuncias")
      .insert({ pedido_id: pedidoId, comprador_id: compradorId, motivo: String(fd.get("motivo")), descripcion })
      .select("id")
      .single();
    if (e1) {
      setEnviando(false);
      return setError("No se pudo registrar la denuncia: " + e1.message);
    }
    for (const a of archivos) {
      const esPdf = a.type === "application/pdf";
      const cuerpo = esPdf ? a : await comprimirImagen(a, 1600);
      const path = `${d.id}/${nombreArchivo(a.name, esPdf ? "pdf" : "webp")}`;
      const { error: e2 } = await supabase.storage.from("evidencias").upload(path, cuerpo, { contentType: esPdf ? "application/pdf" : "image/webp" });
      if (!e2) await supabase.from("denuncia_evidencias").insert({ denuncia_id: d.id, path, nombre: a.name });
    }
    router.push(`/denuncias/${d.id}`);
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4 p-5">
      <fieldset disabled={enviando} className="space-y-4">
        <div>
          <label htmlFor="motivo" className="etiqueta">
            Motivo
          </label>
          <select id="motivo" name="motivo" className="campo">
            {MOTIVOS_DENUNCIA.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="descripcion" className="etiqueta">
            ¿Qué pasó?
          </label>
          <textarea id="descripcion" name="descripcion" rows={5} required minLength={10} maxLength={3000} className="campo" />
        </div>
        <div>
          <p className="etiqueta">Evidencia (fotos o PDF, hasta {MAX_ARCHIVOS})</p>
          <label className="btn-secundario cursor-pointer">
            Adjuntar archivos
            <input
              type="file"
              multiple
              accept={PERMITIDOS.join(",")}
              className="sr-only"
              onChange={(e) => {
                const nuevos = Array.from(e.target.files ?? []).filter((f) => PERMITIDOS.includes(f.type) && f.size <= 10 * 1024 * 1024);
                setArchivos((prev) => [...prev, ...nuevos].slice(0, MAX_ARCHIVOS));
                e.target.value = "";
              }}
            />
          </label>
          {archivos.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {archivos.map((a, i) => (
                <li key={a.name + i} className="flex items-center justify-between rounded-lg bg-fondo px-3 py-1.5">
                  <span className="truncate">{a.name}</span>
                  <button type="button" onClick={() => setArchivos((p) => p.filter((_, j) => j !== i))} className="text-xs text-red-700 hover:underline">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="ayuda">Solo tú y el personal de soporte podrán ver la evidencia.</p>
        </div>
      </fieldset>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primario w-full" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar denuncia"}
      </button>
    </form>
  );
}
