import Link from "next/link";
import { dinero, RELEVANCIA_META, TIPOS } from "@/lib/formato";
import type { TipoProducto } from "@/lib/tipos";
import { Estrellas, ImagenCarta } from "./ui/basicos";

export interface PublicacionCatalogo {
  id: number;
  nombre: string;
  precio: number;
  tipo: TipoProducto;
  relevancia_meta: number;
  etiquetas: string[];
  estado?: string;
  juego: { nombre: string; slug: string } | null;
  rareza: { nombre: string } | null;
  vendedor: { id: string; nombre: string } | null;
  imagenes: { path: string; orden: number }[];
}

export function TarjetaPublicacion({ p, estrellas }: { p: PublicacionCatalogo; estrellas?: number }) {
  const portada = [...(p.imagenes ?? [])].sort((a, b) => a.orden - b.orden)[0];
  return (
    <Link
      href={`/publicaciones/${p.id}`}
      className="group tarjeta flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-marca/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-fondo">
        <ImagenCarta path={portada?.path} nombre={p.nombre} juegoSlug={p.juego?.slug} className="transition group-hover:scale-[1.03]" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="rounded-md bg-tinta/85 px-1.5 py-0.5 text-[11px] font-semibold text-white">{TIPOS[p.tipo]}</span>
          {p.relevancia_meta > 0 && (
            <span className="rounded-md bg-acento px-1.5 py-0.5 text-[11px] font-bold text-tinta">
              {RELEVANCIA_META[p.relevancia_meta]}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-texto-suave">
          {p.juego?.nombre}
          {p.rareza && ` · ${p.rareza.nombre}`}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-tinta">{p.nombre}</h3>
        <p className="mt-auto pt-1 text-base font-bold text-tinta">{dinero(p.precio)}</p>
        {p.vendedor && (
          <div className="flex items-center justify-between gap-2 text-xs text-texto-suave">
            <span className="truncate">{p.vendedor.nombre}</span>
            {estrellas !== undefined && <Estrellas valor={estrellas} tamano="text-xs" />}
          </div>
        )}
      </div>
    </Link>
  );
}
