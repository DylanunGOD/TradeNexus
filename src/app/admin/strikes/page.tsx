import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fecha } from "@/lib/formato";
import { Cargando, Seccion } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { registrarStrike } from "../acciones";

export const metadata = { title: "Strikes" };

/** Registro interno de strikes (RF-13). Visible solo para admin y soporte. */
export default function Strikes() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const usuario = await exigirUsuario(["admin", "soporte"]);
  const esAdmin = usuario.perfil.rol === "admin";
  const supabase = await crearClienteServidor();
  const [{ data: strikes }, { data: vendedores }] = await Promise.all([
    supabase
      .from("strikes")
      .select("*, vendedor:perfiles!strikes_vendedor_id_fkey(id, nombre), admin:perfiles!strikes_admin_id_fkey(nombre)")
      .order("created_at", { ascending: false }),
    supabase.from("perfiles").select("id, nombre").eq("rol", "vendedor").order("nombre"),
  ]);

  const porVendedor = new Map<string, { nombre: string; total: number }>();
  for (const s of strikes ?? []) {
    const v = s.vendedor as { id: string; nombre: string };
    porVendedor.set(v.id, { nombre: v.nombre, total: (porVendedor.get(v.id)?.total ?? 0) + 1 });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Strikes</h1>
        <p className="mt-1 text-sm text-texto-suave">Registro interno de incidentes de vendedores. Los compradores no pueden verlo.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Seccion titulo="Historial">
          {strikes?.length ? (
            <ul className="divide-y divide-borde">
              {strikes.map((s) => (
                <li key={s.id} className="py-3 text-sm">
                  <p>
                    <Link href={`/vendedores/${(s.vendedor as { id: string }).id}`} className="font-semibold hover:text-marca">
                      {(s.vendedor as { nombre: string }).nombre}
                    </Link>{" "}
                    — {s.motivo}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {fecha(s.created_at)} · registrado por {(s.admin as { nombre: string } | null)?.nombre}
                    {s.denuncia_id && (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/soporte/${s.denuncia_id}`} className="enlace">
                          denuncia #{s.denuncia_id}
                        </Link>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-texto-suave">No hay strikes registrados.</p>
          )}
        </Seccion>
        <div className="space-y-6">
          {esAdmin && (
            <Seccion titulo="Registrar strike">
              <FormAccion action={registrarStrike} limpiarAlTerminar className="space-y-3">
                <select name="vendedor_id" required className="campo" defaultValue="">
                  <option value="" disabled>
                    Selecciona el vendedor
                  </option>
                  {vendedores?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
                <textarea name="motivo" required minLength={5} rows={3} className="campo" placeholder="Motivo" />
                <BotonEnviar className="btn-peligro w-full">Registrar</BotonEnviar>
              </FormAccion>
            </Seccion>
          )}
          <Seccion titulo="Por vendedor">
            {porVendedor.size ? (
              <ul className="space-y-1 text-sm">
                {[...porVendedor.entries()]
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([id, v]) => (
                    <li key={id} className="flex justify-between">
                      <span>{v.nombre}</span>
                      <span className="font-semibold text-red-700">{v.total}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-texto-suave">—</p>
            )}
          </Seccion>
        </div>
      </div>
    </div>
  );
}
