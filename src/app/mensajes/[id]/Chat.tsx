"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { fecha, hora } from "@/lib/formato";
import type { Mensaje } from "@/lib/tipos";

/**
 * Chat en tiempo real (RN-02). Los mensajes nuevos llegan por Supabase
 * Realtime; RLS garantiza que solo los dos participantes los reciban.
 */
export function Chat({
  conversacionId,
  usuarioId,
  iniciales,
  nombres,
}: {
  conversacionId: number;
  usuarioId: string;
  iniciales: Mensaje[];
  nombres: Record<string, string>;
}) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [mensajes, setMensajes] = useState(iniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const fondo = useRef<HTMLDivElement>(null);

  const agregar = (m: Mensaje) => setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  useEffect(() => {
    const marcarLeido = () =>
      supabase.from("notificaciones").update({ leida: true }).eq("referencia", `conversacion:${conversacionId}`).eq("leida", false);
    marcarLeido();

    const canal = supabase
      .channel(`chat-${conversacionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conversacionId}` },
        (cambio) => {
          agregar(cambio.new as Mensaje);
          marcarLeido();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, conversacionId]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido) return;
    setEnviando(true);
    setError("");
    const { data, error: err } = await supabase
      .from("mensajes")
      .insert({ conversacion_id: conversacionId, autor_id: usuarioId, contenido })
      .select()
      .single();
    setEnviando(false);
    if (err) return setError("No se pudo enviar el mensaje.");
    setTexto("");
    agregar(data as Mensaje);
  }

  return (
    <>
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-fondo/60 px-4 py-4" aria-live="polite">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-sm text-texto-suave">Escribe el primer mensaje para coordinar la compra.</p>
        )}
        {mensajes.map((m, i) => {
          const propio = m.autor_id === usuarioId;
          const dia = fecha(m.created_at);
          const separador = i === 0 || dia !== fecha(mensajes[i - 1].created_at);
          return (
            <div key={m.id}>
              {separador && (
                <p className="my-3 text-center text-[11px] font-medium uppercase tracking-wide text-texto-suave">{dia}</p>
              )}
              <div className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    propio ? "rounded-br-md bg-marca text-white" : "rounded-bl-md bg-white text-tinta"
                  }`}
                >
                  {!propio && <p className="mb-0.5 text-[11px] font-semibold text-marca">{nombres[m.autor_id]}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${propio ? "text-white/70" : "text-texto-suave"}`}>{hora(m.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fondo} />
      </div>
      <form onSubmit={enviar} className="flex gap-2 border-t border-borde bg-white p-3">
        <label htmlFor="mensaje" className="sr-only">
          Mensaje
        </label>
        <textarea
          id="mensaje"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(e);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Escribe un mensaje…"
          className="campo max-h-32 min-h-10 resize-none"
        />
        <button type="submit" className="btn-primario shrink-0" disabled={enviando || !texto.trim()}>
          {enviando ? "…" : "Enviar"}
        </button>
      </form>
      {error && <p className="bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>}
    </>
  );
}
