import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { dinero, fecha, RELEVANCIA_META, TIPOS } from "@/lib/formato";
import { Cargando, ImagenCarta, Vacio } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { cambiarEstadoPublicacion } from "./acciones";

export const metadata = { title: "Mis publicaciones" };
const MAX_ACTIVAS = 5;

export default function MisPublicaciones() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const { id } = await exigirUsuario(["vendedor"]);
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("publicaciones")
    .select("*, juego:juegos(nombre, slug), rareza:rarezas(nombre), imagenes:publicacion_imagenes(path, orden)")
    .eq("vendedor_id", id)
    .order("estado")
    .order("updated_at", { ascending: false });

  const publicaciones = data ?? [];
  const activas = publicaciones.filter((p) => p.estado === "activa").length;
  const lleno = activas >= MAX_ACTIVAS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="titulo-pagina">Mis publicaciones</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Tienes <strong className="text-tinta">{activas} de {MAX_ACTIVAS}</strong> publicaciones activas. Cada una admite hasta 4
            imágenes.
          </p>
        </div>
        {lleno ? (
          <span className="btn-secundario cursor-not-allowed opacity-60" title="Retira una publicación para crear otra">
            Límite alcanzado
          </span>
        ) : (
          <Link href="/vendedor/publicaciones/nueva" className="btn-primario">
            + Nueva publicación
          </Link>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-borde" aria-hidden>
        <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${(activas / MAX_ACTIVAS) * 100}%` }} />
      </div>

      {publicaciones.length === 0 ? (
        <Vacio
          titulo="Aún no tienes publicaciones"
          texto="Publica tu primera carta con fotos, precio y descripción."
          accion={{ href: "/vendedor/publicaciones/nueva", texto: "Crear publicación" }}
        />
      ) : (
        <ul className="space-y-3">
          {publicaciones.map((p) => {
            const portada = [...p.imagenes].sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)[0];
            const activa = p.estado === "activa";
            return (
              <li key={p.id} className={`tarjeta flex gap-4 p-3 ${activa ? "" : "opacity-70"}`}>
                <div className="h-24 w-[72px] shrink-0 overflow-hidden rounded-lg">
                  <ImagenCarta path={portada?.path} nombre={p.nombre} juegoSlug={p.juego.slug} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activa ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                      {activa ? "Activa" : "Retirada"}
                    </span>
                    <span className="text-xs text-texto-suave">
                      {p.juego.nombre}
                      {p.rareza && ` · ${p.rareza.nombre}`} · {TIPOS[p.tipo as "single" | "base"]} · Meta: {RELEVANCIA_META[p.relevancia_meta]}
                    </span>
                  </div>
                  <Link href={`/publicaciones/${p.id}`} className="truncate font-semibold hover:text-marca">
                    {p.nombre}
                  </Link>
                  <p className="text-sm">
                    <strong>{dinero(p.precio)}</strong>{" "}
                    <span className="text-xs text-texto-suave">
                      · {p.imagenes.length}/4 imágenes · actualizada {fecha(p.updated_at)}
                    </span>
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Link href={`/vendedor/publicaciones/${p.id}/editar`} className="btn-secundario px-3 py-1.5 text-xs">
                      Editar
                    </Link>
                    <FormAccion action={cambiarEstadoPublicacion.bind(null, p.id, activa ? "retirada" : "activa")}>
                      <BotonEnviar className={`${activa ? "btn-peligro" : "btn-secundario"} px-3 py-1.5 text-xs`} textoEnviando="…">
                        {activa ? "Retirar" : "Volver a publicar"}
                      </BotonEnviar>
                    </FormAccion>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
