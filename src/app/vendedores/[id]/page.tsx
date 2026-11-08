import { notFound } from "next/navigation";
import { Suspense } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fecha } from "@/lib/formato";
import type { ResumenVendedor, Tienda } from "@/lib/tipos";
import { Avatar, Cargando, Estrellas, Vacio } from "@/components/ui/basicos";
import { TarjetaPublicacion, type PublicacionCatalogo } from "@/components/TarjetaPublicacion";

/** Perfil público del vendedor (RF-14): nombre, tienda, foto, estrellas, pedidos y ventas. */
export default function PerfilVendedor({ params }: PageProps<"/vendedores/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/vendedores/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("vendedores_resumen").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const v = data as ResumenVendedor;

  const [{ data: tienda }, { data: publicaciones }, { data: resenas }] = await Promise.all([
    v.tienda_id ? supabase.from("tiendas").select("*").eq("id", v.tienda_id).single() : Promise.resolve({ data: null }),
    supabase
      .from("publicaciones")
      .select("id, nombre, precio, tipo, relevancia_meta, etiquetas, juego:juegos(nombre, slug), rareza:rarezas(nombre), vendedor:perfiles(id, nombre), imagenes:publicacion_imagenes(path, orden)")
      .eq("vendedor_id", id)
      .eq("estado", "activa")
      .order("created_at", { ascending: false }),
    supabase
      .from("calificaciones")
      .select("id, estrellas, comentario, created_at, comprador:perfiles!calificaciones_comprador_id_fkey(nombre)")
      .eq("vendedor_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const t = tienda as Tienda | null;

  return (
    <div className="space-y-8">
      <section className="tarjeta flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar nombre={v.nombre} path={v.foto_path} tamano={88} />
        <div className="flex-1">
          <h1 className="titulo-pagina">{v.nombre}</h1>
          <div className="mt-1">
            <Estrellas valor={v.estrellas} total={v.total_calificaciones} tamano="text-base" />
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            {t ? `Entrega en ${t.nombre} (${t.provincia})` : "Sin tienda asignada"} · Miembro desde {fecha(v.created_at)}
          </p>
          {v.bio && <p className="mt-3 max-w-2xl text-sm text-tinta-suave">{v.bio}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-center sm:w-56">
          <div className="rounded-xl bg-fondo p-3">
            <dt className="text-xs text-texto-suave">Pedidos</dt>
            <dd className="text-2xl font-bold">{v.pedidos}</dd>
          </div>
          <div className="rounded-xl bg-fondo p-3">
            <dt className="text-xs text-texto-suave">Ventas</dt>
            <dd className="text-2xl font-bold">{v.ventas}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Publicaciones activas</h2>
        {publicaciones?.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(publicaciones as unknown as PublicacionCatalogo[]).map((p) => (
              <TarjetaPublicacion key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Vacio titulo="Este vendedor no tiene publicaciones activas" />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Calificaciones recientes</h2>
        {resenas?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {resenas.map((r) => (
              <li key={r.id} className="tarjeta p-4">
                <div className="flex items-center justify-between">
                  <Estrellas valor={r.estrellas} />
                  <span className="text-xs text-texto-suave">{fecha(r.created_at)}</span>
                </div>
                {r.comentario && <p className="mt-2 text-sm text-tinta-suave">“{r.comentario}”</p>}
                <p className="mt-2 text-xs text-texto-suave">— {(r.comprador as unknown as { nombre: string } | null)?.nombre}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-texto-suave">Todavía no tiene calificaciones.</p>
        )}
      </section>
    </div>
  );
}
