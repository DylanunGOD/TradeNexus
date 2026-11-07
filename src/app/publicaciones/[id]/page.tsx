import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { obtenerUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { dinero, fecha, RELEVANCIA_META, TIPOS } from "@/lib/formato";
import type { ResumenVendedor, Tienda } from "@/lib/tipos";
import { Avatar, Cargando, Estrellas } from "@/components/ui/basicos";
import { TarjetaPublicacion, type PublicacionCatalogo } from "@/components/TarjetaPublicacion";
import { Galeria } from "./Galeria";

export default function PaginaPublicacion({ params }: PageProps<"/publicaciones/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Detalle params={params} />
    </Suspense>
  );
}

async function Detalle({ params }: { params: PageProps<"/publicaciones/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await obtenerUsuario();

  const { data: p } = await supabase
    .from("publicaciones")
    .select("*, juego:juegos(nombre, slug), rareza:rarezas(nombre), imagenes:publicacion_imagenes(path, orden)")
    .eq("id", Number(id))
    .maybeSingle();
  if (!p) notFound();

  const [{ data: vendedor }, { data: otras }] = await Promise.all([
    supabase.from("vendedores_resumen").select("*").eq("id", p.vendedor_id).single(),
    supabase
      .from("publicaciones")
      .select("id, nombre, precio, tipo, relevancia_meta, etiquetas, juego:juegos(nombre, slug), rareza:rarezas(nombre), vendedor:perfiles(id, nombre), imagenes:publicacion_imagenes(path, orden)")
      .eq("vendedor_id", p.vendedor_id)
      .eq("estado", "activa")
      .neq("id", p.id)
      .limit(4),
  ]);
  const v = vendedor as ResumenVendedor | null;
  const { data: tienda } = v?.tienda_id
    ? await supabase.from("tiendas").select("*").eq("id", v.tienda_id).single()
    : { data: null };

  const esDueno = usuario?.id === p.vendedor_id;
  const imagenes = [...(p.imagenes as { path: string; orden: number }[])].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-10">
      <nav className="text-sm text-texto-suave">
        <Link href="/" className="hover:text-marca">
          Catálogo
        </Link>{" "}
        /{" "}
        <Link href={`/?juego=${p.juego.slug}`} className="hover:text-marca">
          {p.juego.nombre}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Galeria imagenes={imagenes.map((i) => i.path)} nombre={p.nombre} juegoSlug={p.juego.slug} />

        <div className="space-y-5">
          {p.estado === "retirada" && (
            <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">Esta publicación fue retirada y no aparece en el catálogo.</p>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
              {p.juego.nombre}
              {p.rareza && ` · ${p.rareza.nombre}`}
            </p>
            <h1 className="titulo-pagina mt-1">{p.nombre}</h1>
            <p className="mt-3 text-3xl font-bold text-tinta">{dinero(p.precio)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="chip">{TIPOS[p.tipo as "single" | "base"]}</span>
            <span className={`chip ${p.relevancia_meta > 0 ? "border-acento bg-amber-50 text-amber-900" : ""}`}>
              Meta: {RELEVANCIA_META[p.relevancia_meta]}
            </span>
            {(p.etiquetas as string[]).map((e) => (
              <Link key={e} href={`/?etiqueta=${encodeURIComponent(e)}`} className="chip hover:border-marca">
                #{e}
              </Link>
            ))}
          </div>

          {p.descripcion && <p className="whitespace-pre-line text-sm leading-relaxed text-tinta-suave">{p.descripcion}</p>}

          {v && (
            <div className="tarjeta flex items-center gap-4 p-4">
              <Avatar nombre={v.nombre} path={v.foto_path} tamano={48} />
              <div className="min-w-0 flex-1">
                <Link href={`/vendedores/${v.id}`} className="font-semibold text-tinta hover:text-marca">
                  {v.nombre}
                </Link>
                <div className="mt-0.5">
                  <Estrellas valor={v.estrellas} total={v.total_calificaciones} />
                </div>
                <p className="mt-0.5 text-xs text-texto-suave">
                  {v.ventas} ventas · entrega en {(tienda as Tienda | null)?.nombre ?? "tienda por definir"}
                </p>
              </div>
            </div>
          )}

          {esDueno ? (
            <Link href={`/vendedor/publicaciones/${p.id}/editar`} className="btn-secundario w-full">
              Editar publicación
            </Link>
          ) : !usuario ? (
            <Link href={`/login?destino=/publicaciones/${p.id}`} className="btn-primario w-full py-3">
              Inicia sesión para contactar al vendedor
            </Link>
          ) : null}

          <div className="rounded-xl bg-marca-clara/60 p-4 text-xs leading-relaxed text-tinta-suave">
            <p className="font-semibold text-tinta">¿Cómo funciona la compra?</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Coordinas los detalles con el vendedor por el chat y él arma tu pedido.</li>
              <li>Pagas por un medio externo y adjuntas el comprobante.</li>
              <li>El paquete viaja por la red de tiendas hasta tu tienda de preferencia.</li>
              <li>Lo retiras presentando tu código de confirmación.</li>
            </ol>
          </div>
          <p className="text-xs text-texto-suave">Publicado el {fecha(p.created_at)}</p>
        </div>
      </div>

      {otras && otras.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Más de {v?.nombre}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(otras as unknown as PublicacionCatalogo[]).map((o) => (
              <TarjetaPublicacion key={o.id} p={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
