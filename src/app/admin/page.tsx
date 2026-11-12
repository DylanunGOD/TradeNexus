import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_PEDIDO, ROLES } from "@/lib/formato";
import type { EstadoPedido, Rol } from "@/lib/tipos";
import { Cargando, Seccion } from "@/components/ui/basicos";

export const metadata = { title: "Administración" };

export default function PanelAdmin() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const [{ data: perfiles }, { data: pedidos }, { count: publicaciones }, { count: denuncias }, { count: strikes }] = await Promise.all([
    supabase.from("perfiles").select("rol"),
    supabase.from("pedidos").select("estado"),
    supabase.from("publicaciones").select("id", { count: "exact", head: true }).eq("estado", "activa"),
    supabase.from("denuncias").select("id", { count: "exact", head: true }).neq("estado", "cerrada"),
    supabase.from("strikes").select("id", { count: "exact", head: true }),
  ]);
  const cuenta = <T extends string>(lista: { [k: string]: unknown }[] | null, campo: string, valor: T) =>
    (lista ?? []).filter((x) => x[campo] === valor).length;

  const tarjetas = [
    { texto: "Usuarios", valor: perfiles?.length ?? 0, href: "/admin/usuarios" },
    { texto: "Publicaciones activas", valor: publicaciones ?? 0, href: "/admin/publicaciones" },
    { texto: "Pedidos", valor: pedidos?.length ?? 0, href: "/admin/pedidos" },
    { texto: "Denuncias abiertas", valor: denuncias ?? 0, href: "/soporte" },
    { texto: "Strikes", valor: strikes ?? 0, href: "/admin/strikes" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="titulo-pagina">Administración</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tarjetas.map((t) => (
          <Link key={t.texto} href={t.href} className="tarjeta p-4 hover:border-marca">
            <p className="text-xs font-medium text-texto-suave">{t.texto}</p>
            <p className="text-3xl font-bold">{t.valor}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Seccion titulo="Pedidos por estado">
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(ESTADOS_PEDIDO) as EstadoPedido[]).map((e) => (
              <li key={e} className="flex justify-between">
                <Link href={`/admin/pedidos?estado=${e}`} className="hover:text-marca">
                  {ESTADOS_PEDIDO[e].texto}
                </Link>
                <span className="font-semibold">{cuenta(pedidos, "estado", e)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
        <Seccion titulo="Usuarios por rol">
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(ROLES) as Rol[]).map((r) => (
              <li key={r} className="flex justify-between">
                <Link href={`/admin/usuarios?rol=${r}`} className="hover:text-marca">
                  {ROLES[r]}
                </Link>
                <span className="font-semibold">{cuenta(perfiles, "rol", r)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </div>
  );
}
