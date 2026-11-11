"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { fechaHora } from "@/lib/formato";
import type { Notificacion } from "@/lib/tipos";

/**
 * Campana de notificaciones (RF-10). Escucha en tiempo real la tabla
 * "notificaciones" y, cuando llega una nueva, actualiza el contador y
 * refresca la página actual para mostrar el estado más reciente.
 */
export function Campana({ usuarioId, inicial }: { usuarioId: string; inicial: number }) {
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const router = useRouter();
  const [noLeidas, setNoLeidas] = useState(inicial);
  const [abierta, setAbierta] = useState(false);
  const [items, setItems] = useState<Notificacion[] | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  // Si el servidor envía un contador nuevo (p. ej. al navegar), se adopta.
  const [inicialPrevio, setInicialPrevio] = useState(inicial);
  if (inicial !== inicialPrevio) {
    setInicialPrevio(inicial);
    setNoLeidas(inicial);
  }

  useEffect(() => {
    const canal = supabase
      .channel(`notificaciones-${usuarioId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${usuarioId}` },
        async (cambio) => {
          const { count } = await supabase
            .from("notificaciones")
            .select("id", { count: "exact", head: true })
            .eq("leida", false);
          setNoLeidas(count ?? 0);
          if (cambio.eventType !== "UPDATE") router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, usuarioId, router]);

  useEffect(() => {
    if (!abierta) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierta]);

  async function abrir() {
    const nueva = !abierta;
    setAbierta(nueva);
    if (nueva) {
      const { data } = await supabase
        .from("notificaciones")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      setItems((data as Notificacion[]) ?? []);
    }
  }

  async function marcarTodas() {
    await supabase.rpc("marcar_notificaciones_leidas");
    setNoLeidas(0);
    setItems((prev) => prev?.map((n) => ({ ...n, leida: true })) ?? null);
  }

  async function abrirNotificacion(n: Notificacion) {
    if (!n.leida) {
      await supabase.from("notificaciones").update({ leida: true }).eq("id", n.id);
      setNoLeidas((c) => Math.max(0, c - 1));
    }
    setAbierta(false);
    if (n.enlace) router.push(n.enlace);
  }

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={abrir}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/90 hover:bg-white/10"
        aria-label={`Notificaciones${noLeidas ? `: ${noLeidas} sin leer` : ""}`}
        aria-expanded={abierta}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-acento px-1 text-center text-[11px] font-bold leading-5 text-tinta">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-borde bg-white text-tinta shadow-xl">
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {noLeidas > 0 && (
              <button type="button" onClick={marcarTodas} className="text-xs font-medium text-marca hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-borde overflow-y-auto">
            {items === null && <li className="px-4 py-6 text-center text-sm text-texto-suave">Cargando…</li>}
            {items?.length === 0 && <li className="px-4 py-6 text-center text-sm text-texto-suave">No tienes notificaciones.</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrirNotificacion(n)}
                  className={`block w-full px-4 py-3 text-left hover:bg-fondo ${n.leida ? "" : "bg-marca-clara/50"}`}
                >
                  <p className="flex items-start gap-2 text-sm font-medium">
                    {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marca" aria-label="Sin leer" />}
                    {n.titulo}
                  </p>
                  {n.mensaje && <p className="mt-0.5 line-clamp-2 text-xs text-texto-suave">{n.mensaje}</p>}
                  <p className="mt-1 text-[11px] text-texto-suave">{fechaHora(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/notificaciones"
            onClick={() => setAbierta(false)}
            className="block border-t border-borde px-4 py-2.5 text-center text-sm font-medium text-marca hover:bg-fondo"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
