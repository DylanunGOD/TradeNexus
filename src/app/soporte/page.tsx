import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { codigoPedido, ESTADOS_DENUNCIA, fechaHora } from "@/lib/formato";
import type { EstadoDenuncia } from "@/lib/tipos";
import { Cargando, EstadoDenunciaBadge, Vacio } from "@/components/ui/basicos";

export const metadata = { title: "Denuncias" };

/** Bandeja de denuncias para soporte (HU-18). */
export default function BandejaSoporte({ searchParams }: PageProps<"/soporte">) {
  return (
    <div className="space-y-5">
      <h1 className="titulo-pagina">Denuncias</h1>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/soporte">["searchParams"] }) {
  await exigirUsuario(["soporte", "admin"]);
  const { estado } = await searchParams;
  const filtro = typeof estado === "string" && estado in ESTADOS_DENUNCIA ? (estado as EstadoDenuncia) : null;
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("denuncias")
    .select("*, comprador:perfiles!denuncias_comprador_id_fkey(nombre), vendedor:perfiles!denuncias_vendedor_id_fkey(nombre)")
    .order("updated_at", { ascending: false });
  consulta = filtro ? consulta.eq("estado", filtro) : consulta.neq("estado", "cerrada");
  const { data } = await consulta;

  const { data: todas } = await supabase.from("denuncias").select("estado");
  const conteo = (e: string) => (todas ?? []).filter((d) => d.estado === e).length;

  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
        <Link href="/soporte" className={`chip ${!filtro ? "border-tinta bg-tinta text-white" : ""}`}>
          Pendientes ({conteo("abierta") + conteo("en_revision") + conteo("resuelta")})
        </Link>
        {(Object.keys(ESTADOS_DENUNCIA) as EstadoDenuncia[]).map((e) => (
          <Link key={e} href={`/soporte?estado=${e}`} className={`chip ${filtro === e ? "border-tinta bg-tinta text-white" : ""}`}>
            {ESTADOS_DENUNCIA[e].texto} ({conteo(e)})
          </Link>
        ))}
      </nav>
      {!data?.length ? (
        <Vacio titulo="No hay denuncias en esta vista" />
      ) : (
        <ul className="tarjeta divide-y divide-borde overflow-hidden">
          {data.map((d) => (
            <li key={d.id}>
              <Link href={`/soporte/${d.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-fondo sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    #{d.id} · {d.motivo}
                  </p>
                  <p className="truncate text-xs text-texto-suave">
                    {(d.comprador as { nombre: string } | null)?.nombre} contra {(d.vendedor as { nombre: string } | null)?.nombre} · Pedido {codigoPedido(d.pedido_id)} ·
                    actualizada {fechaHora(d.updated_at)}
                  </p>
                </div>
                <EstadoDenunciaBadge estado={d.estado as EstadoDenuncia} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
