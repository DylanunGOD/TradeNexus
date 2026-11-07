import Link from "next/link";
import { ESTADOS_DENUNCIA, ESTADOS_PEDIDO } from "@/lib/formato";
import type { EstadoDenuncia, EstadoPedido } from "@/lib/tipos";
import { urlPublica } from "@/lib/storage";

export function Estrellas({ valor, total, tamano = "text-sm" }: { valor: number; total?: number; tamano?: string }) {
  const redondeado = Math.round(Number(valor));
  return (
    <span className={`inline-flex items-center gap-1 ${tamano}`} aria-label={`${Number(valor).toFixed(1)} de 5 estrellas`}>
      <span className="tracking-tight text-acento" aria-hidden>
        {"★★★★★".slice(0, redondeado)}
        <span className="text-borde">{"★★★★★".slice(redondeado)}</span>
      </span>
      <span className="font-medium text-tinta">{Number(valor) > 0 ? Number(valor).toFixed(1) : "—"}</span>
      {total !== undefined && <span className="text-texto-suave">({total})</span>}
    </span>
  );
}

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  const e = ESTADOS_PEDIDO[estado];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.color}`}>{e.texto}</span>;
}

export function EstadoDenunciaBadge({ estado }: { estado: EstadoDenuncia }) {
  const e = ESTADOS_DENUNCIA[estado];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.color}`}>{e.texto}</span>;
}

export function Avatar({ nombre, path, tamano = 40 }: { nombre: string; path: string | null; tamano?: number }) {
  if (path) {
    return (
      <img
        src={urlPublica("avatars", path)}
        alt={nombre}
        width={tamano}
        height={tamano}
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamano, height: tamano }}
      />
    );
  }
  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-marca-clara font-semibold text-marca"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.38 }}
      aria-hidden
    >
      {iniciales}
    </span>
  );
}

const COLORES_JUEGO: Record<string, string> = {
  pokemon: "from-amber-300 via-yellow-200 to-sky-300",
  magic: "from-orange-300 via-stone-200 to-emerald-300",
  yugioh: "from-violet-400 via-fuchsia-200 to-amber-200",
  "one-piece": "from-red-300 via-rose-100 to-sky-300",
  lorcana: "from-indigo-400 via-sky-200 to-amber-200",
};

/** Imagen de la carta o, si no tiene, un marcador con estilo de carta. */
export function ImagenCarta({
  path,
  nombre,
  juegoSlug,
  className = "",
}: {
  path?: string | null;
  nombre: string;
  juegoSlug?: string;
  className?: string;
}) {
  if (path) {
    return (
      <img
        src={urlPublica("publicaciones", path)}
        alt={nombre}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const grad = COLORES_JUEGO[juegoSlug ?? ""] ?? "from-marca-clara via-white to-violet-200";
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${grad} ${className}`} aria-label={nombre}>
      <div className="flex h-[78%] w-[62%] flex-col items-center justify-center rounded-lg border-4 border-white/80 bg-white/40 p-2 text-center shadow-inner backdrop-blur-sm">
        <span className="text-3xl" aria-hidden>
          ✦
        </span>
        <span className="mt-1 line-clamp-3 text-xs font-semibold text-tinta/80">{nombre}</span>
      </div>
    </div>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: { href: string; texto: string } }) {
  return (
    <div className="tarjeta flex flex-col items-center px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        🃏
      </span>
      <p className="mt-3 font-semibold text-tinta">{titulo}</p>
      {texto && <p className="mt-1 max-w-md text-sm text-texto-suave">{texto}</p>}
      {accion && (
        <Link href={accion.href} className="btn-primario mt-4">
          {accion.texto}
        </Link>
      )}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-texto-suave" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-marca/30 border-t-marca" />
      {texto}
    </div>
  );
}

export function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="tarjeta p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
