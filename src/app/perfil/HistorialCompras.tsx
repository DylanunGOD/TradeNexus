"use client";

import Link from "next/link";
import { useState } from "react";

interface Compra {
  id: number;
  codigo: string;
  estado: string;
  total: string;
  fecha: string;
  vendedor: string;
}

/** Historial de compras del comprador; las canceladas quedan ocultas tras un botón (RF-14). */
export function HistorialCompras({ compras, badges }: { compras: Compra[]; badges: Record<number, React.ReactNode> }) {
  const [verCanceladas, setVerCanceladas] = useState(false);
  const activas = compras.filter((c) => c.estado !== "cancelado");
  const canceladas = compras.filter((c) => c.estado === "cancelado");

  if (!compras.length) return <p className="text-sm text-texto-suave">Todavía no tienes compras.</p>;

  const Fila = ({ c }: { c: Compra }) => (
    <li>
      <Link href={`/pedidos/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-fondo">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {c.codigo} <span className="font-normal text-texto-suave">· {c.vendedor}</span>
          </p>
          <p className="text-xs text-texto-suave">{c.fecha}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {badges[c.id]}
          <span className="text-sm font-medium">{c.total}</span>
        </div>
      </Link>
    </li>
  );

  return (
    <div>
      <ul className="-mx-3 divide-y divide-borde">
        {activas.map((c) => (
          <Fila key={c.id} c={c} />
        ))}
      </ul>
      {activas.length === 0 && <p className="text-sm text-texto-suave">No tienes compras activas.</p>}
      {canceladas.length > 0 && (
        <div className="mt-3 border-t border-borde pt-3">
          <button type="button" onClick={() => setVerCanceladas((v) => !v)} className="text-sm font-medium text-marca hover:underline" aria-expanded={verCanceladas}>
            {verCanceladas ? "Ocultar" : "Ver"} compras canceladas ({canceladas.length})
          </button>
          {verCanceladas && (
            <ul className="-mx-3 mt-2 divide-y divide-borde opacity-80">
              {canceladas.map((c) => (
                <Fila key={c.id} c={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
