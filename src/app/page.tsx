import Link from "next/link";
import { Suspense } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TarjetaPublicacion, type PublicacionCatalogo } from "@/components/TarjetaPublicacion";
import { Cargando, Vacio } from "@/components/ui/basicos";
import type { Juego, Rareza } from "@/lib/tipos";
import { FiltrosCatalogo } from "./FiltrosCatalogo";

const POR_PAGINA = 24;

type Filtros = { q?: string; juego?: string; rareza?: string; tipo?: string; etiqueta?: string; orden?: string; pagina?: string };

export default function Catalogo({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-tinta px-6 py-8 text-white sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-marca/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-acento">Red de tiendas afiliadas</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold leading-tight sm:text-4xl">
            Cartas coleccionables con seguimiento hasta tu tienda
          </h1>
          <p className="mt-3 text-sm text-white/75 sm:text-base">
            Encuentra singles y bases de tus juegos favoritos, habla con el vendedor y retira tu pedido con un código en tu
            punto de retiro.
          </p>
        </div>
      </section>

      <Suspense fallback={<Cargando texto="Cargando catálogo…" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = (await searchParams) as Filtros;
  const supabase = await crearClienteServidor();

  const [{ data: juegos }, { data: rarezas }, { data: etiquetasRaw }] = await Promise.all([
    supabase.from("juegos").select("*").order("orden"),
    supabase.from("rarezas").select("*").order("orden"),
    supabase.from("publicaciones").select("etiquetas").eq("estado", "activa").limit(300),
  ]);

  const juego = (juegos as Juego[] | null)?.find((j) => j.slug === sp.juego);
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  let consulta = supabase
    .from("publicaciones")
    .select(
      "id, nombre, precio, tipo, relevancia_meta, etiquetas, juego:juegos(nombre, slug), rareza:rarezas(nombre), vendedor:perfiles(id, nombre), imagenes:publicacion_imagenes(path, orden)",
      { count: "exact" },
    )
    .eq("estado", "activa");

  if (juego) consulta = consulta.eq("juego_id", juego.id);
  if (juego && sp.rareza) consulta = consulta.eq("rareza_id", Number(sp.rareza));
  if (sp.tipo === "single" || sp.tipo === "base") consulta = consulta.eq("tipo", sp.tipo);
  if (sp.etiqueta) consulta = consulta.contains("etiquetas", [sp.etiqueta]);
  if (sp.q?.trim()) {
    const q = sp.q.trim().replace(/[,()%]/g, " ");
    consulta = consulta.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`);
  }

  switch (sp.orden) {
    case "precio_asc":
      consulta = consulta.order("precio", { ascending: true });
      break;
    case "precio_desc":
      consulta = consulta.order("precio", { ascending: false });
      break;
    default:
      consulta = consulta.order("created_at", { ascending: false });
  }

  const desde = (pagina - 1) * POR_PAGINA;
  const { data, count, error } = await consulta.range(desde, desde + POR_PAGINA - 1);
  const publicaciones = (data ?? []) as unknown as PublicacionCatalogo[];

  // Estrellas de los vendedores que aparecen en esta página
  const idsVendedores = [...new Set(publicaciones.map((p) => p.vendedor?.id).filter(Boolean))] as string[];
  const { data: resumen } = idsVendedores.length
    ? await supabase.from("vendedores_resumen").select("id, estrellas").in("id", idsVendedores)
    : { data: [] };
  const estrellas = new Map((resumen ?? []).map((r) => [r.id as string, Number(r.estrellas)]));

  // Etiquetas más usadas
  const conteo = new Map<string, number>();
  for (const fila of etiquetasRaw ?? []) for (const e of fila.etiquetas as string[]) conteo.set(e, (conteo.get(e) ?? 0) + 1);
  const etiquetas = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([e]) => e);

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const enlacePagina = (n: number) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
    params.set("pagina", String(n));
    return `/?${params}`;
  };

  return (
    <div className="space-y-5">
      <FiltrosCatalogo
        juegos={(juegos as Juego[]) ?? []}
        rarezas={((rarezas as Rareza[]) ?? []).filter((r) => r.juego_id === juego?.id)}
        etiquetas={etiquetas}
        valores={sp}
      />

      <div className="flex items-center justify-between text-sm text-texto-suave">
        <p>
          {count ?? 0} {count === 1 ? "publicación" : "publicaciones"}
          {juego && ` de ${juego.nombre}`}
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">No se pudo cargar el catálogo: {error.message}</p>}

      {publicaciones.length === 0 ? (
        <Vacio titulo="No encontramos cartas con esos filtros" texto="Prueba con otro juego, rareza o búsqueda." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {publicaciones.map((p) => (
            <TarjetaPublicacion key={p.id} p={p} estrellas={p.vendedor ? estrellas.get(p.vendedor.id) : undefined} />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {pagina > 1 && (
            <Link href={enlacePagina(pagina - 1)} className="btn-secundario">
              ← Anterior
            </Link>
          )}
          <span className="px-2 text-sm text-texto-suave">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas && (
            <Link href={enlacePagina(pagina + 1)} className="btn-secundario">
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
