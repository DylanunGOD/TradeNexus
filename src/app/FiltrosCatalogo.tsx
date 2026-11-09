"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Juego, Rareza } from "@/lib/tipos";

type Valores = Record<string, string | undefined>;

/** Barra de búsqueda, filtros (juego, rareza, tipo, etiqueta) y orden (RF-02, RF-03). */
export function FiltrosCatalogo({
  juegos,
  rarezas,
  etiquetas,
  valores,
}: {
  juegos: Juego[];
  rarezas: Rareza[];
  etiquetas: string[];
  valores: Valores;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, iniciar] = useTransition();

  function aplicar(cambios: Valores) {
    const params = new URLSearchParams();
    const nuevos: Valores = { ...valores, ...cambios, pagina: undefined };
    if (cambios.juego !== undefined) nuevos.rareza = undefined; // las rarezas dependen del juego
    for (const [k, v] of Object.entries(nuevos)) if (v) params.set(k, v);
    iniciar(() => router.push(`${pathname}?${params}`));
  }

  return (
    <div className={`tarjeta space-y-3 p-4 transition ${pendiente ? "opacity-60" : ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
        }}
        className="flex gap-2"
        role="search"
      >
        <input
          name="q"
          defaultValue={valores.q}
          placeholder="Buscar por nombre o descripción…"
          className="campo"
          aria-label="Buscar cartas"
        />
        <button type="submit" className="btn-primario shrink-0">
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Selector etiqueta="Juego" valor={valores.juego} onChange={(v) => aplicar({ juego: v })}>
          <option value="">Todos los juegos</option>
          {juegos.map((j) => (
            <option key={j.id} value={j.slug}>
              {j.nombre}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Rareza"
          valor={valores.rareza}
          onChange={(v) => aplicar({ rareza: v })}
          deshabilitado={!valores.juego}
          titulo={!valores.juego ? "Primero elige un juego: las rarezas cambian según el juego" : undefined}
        >
          <option value="">{valores.juego ? "Todas las rarezas" : "Elige un juego primero"}</option>
          {rarezas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Tipo" valor={valores.tipo} onChange={(v) => aplicar({ tipo: v })}>
          <option value="">Singles y bases</option>
          <option value="single">Solo singles</option>
          <option value="base">Solo bases</option>
        </Selector>
        <Selector etiqueta="Ordenar por" valor={valores.orden} onChange={(v) => aplicar({ orden: v })}>
          <option value="">Más recientes</option>
          <option value="meta">Relevancia en el meta</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </Selector>
      </div>

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-texto-suave">Etiquetas:</span>
          {etiquetas.map((e) => {
            const activa = valores.etiqueta === e;
            return (
              <button
                key={e}
                type="button"
                onClick={() => aplicar({ etiqueta: activa ? "" : e })}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                  activa ? "border-marca bg-marca text-white" : "border-borde bg-white text-tinta-suave hover:border-marca"
                }`}
                aria-pressed={activa}
              >
                #{e}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Selector({
  etiqueta,
  valor,
  onChange,
  children,
  deshabilitado,
  titulo,
}: {
  etiqueta: string;
  valor?: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  deshabilitado?: boolean;
  titulo?: string;
}) {
  return (
    <label className="block" title={titulo}>
      <span className="mb-1 block text-xs font-medium text-texto-suave">{etiqueta}</span>
      <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)} disabled={deshabilitado} className="campo disabled:bg-fondo">
        {children}
      </select>
    </label>
  );
}
