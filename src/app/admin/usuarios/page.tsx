import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fecha, ROLES } from "@/lib/formato";
import type { Perfil, Rol, Tienda } from "@/lib/tipos";
import { Avatar, Cargando } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { asignarRol } from "../acciones";

export const metadata = { title: "Usuarios y roles" };

/** Creación de cuentas de personal y asignación de roles (RT-03, RNF-05). */
export default function Usuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  const yo = await exigirUsuario(["admin"]);
  const { q, rol } = await searchParams;
  const supabase = await crearClienteServidor();
  let consulta = supabase.from("perfiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (typeof q === "string" && q.trim()) consulta = consulta.ilike("nombre", `%${q.trim()}%`);
  if (typeof rol === "string" && rol in ROLES) consulta = consulta.eq("rol", rol as Rol);
  const [{ data: perfiles }, { data: tiendas }] = await Promise.all([consulta, supabase.from("tiendas").select("*").order("nombre")]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">Usuarios y roles</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Para crear una cuenta de personal (tienda, soporte o admin), la persona se registra normalmente y luego aquí le asignas el rol.
        </p>
      </div>
      <form className="flex flex-wrap gap-2" action="/admin/usuarios">
        <input name="q" defaultValue={typeof q === "string" ? q : ""} placeholder="Buscar por nombre…" className="campo max-w-xs" />
        <select name="rol" defaultValue={typeof rol === "string" ? rol : ""} className="campo max-w-[12rem]">
          <option value="">Todos los roles</option>
          {(Object.keys(ROLES) as Rol[]).map((r) => (
            <option key={r} value={r}>
              {ROLES[r]}
            </option>
          ))}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>
      <ul className="space-y-2">
        {((perfiles as Perfil[]) ?? []).map((p) => (
          <li key={p.id} className="tarjeta flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar nombre={p.nombre} path={p.foto_path} tamano={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {p.nombre} {p.id === yo.id && <span className="text-xs font-normal text-texto-suave">(tú)</span>}
                </p>
                <p className="text-xs text-texto-suave">Desde {fecha(p.created_at)}</p>
              </div>
            </div>
            <FormAccion action={asignarRol.bind(null, p.id)} className="flex flex-wrap items-center gap-2">
              <select name="rol" defaultValue={p.rol} className="campo w-auto py-1.5" aria-label={`Rol de ${p.nombre}`}>
                {(Object.keys(ROLES) as Rol[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r]}
                  </option>
                ))}
              </select>
              <select name="tienda_id" defaultValue={p.tienda_id ?? ""} className="campo w-auto py-1.5" aria-label={`Tienda de ${p.nombre}`}>
                <option value="">Sin tienda</option>
                {((tiendas as Tienda[]) ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
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
