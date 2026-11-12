import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { dinero, RELEVANCIA_META } from "@/lib/formato";
import { Cargando } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { ajustarMeta } from "../acciones";

export const metadata = { title: "Publicaciones" };

/** El admin revisa la relevancia en el meta indicada por los vendedores (RF-03). */
export default function PublicacionesAdmin() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("publicaciones")
    .select("id, nombre, precio, relevancia_meta, juego:juegos(nombre), vendedor:perfiles(nombre)")
    .eq("estado", "activa")
    .order("relevancia_meta", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">Publicaciones activas</h1>
        <p className="mt-1 text-sm text-texto-suave">Ajusta la relevancia en el meta si un vendedor la indicó de forma incorrecta.</p>
      </div>
      <ul className="tarjeta divide-y divide-borde">
        {data?.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Link href={`/publicaciones/${p.id}`} className="text-sm font-semibold hover:text-marca">
                {p.nombre}
              </Link>
              <p className="text-xs text-texto-suave">
                {(p.juego as unknown as { nombre: string }).nombre} · {(p.vendedor as unknown as { nombre: string }).nombre} · {dinero(p.precio)}
              </p>
            </div>
            <FormAccion action={ajustarMeta.bind(null, p.id)} className="flex items-center gap-2">
              <select name="relevancia_meta" defaultValue={p.relevancia_meta} className="campo w-auto py-1.5" aria-label="Relevancia en el meta">
                {RELEVANCIA_META.map((t, i) => (
                  <option key={t} value={i}>
                    {t}
                  </option>
                ))}
              </select>
              <BotonEnviar className="btn-secundario py-1.5" textoEnviando="…">
                Guardar
              </BotonEnviar>
            </FormAccion>
          </li>
        ))}
      </ul>
    </div>
  );
}
