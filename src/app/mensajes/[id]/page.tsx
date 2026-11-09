import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { dinero } from "@/lib/formato";
import type { Mensaje } from "@/lib/tipos";
import { Avatar, Cargando } from "@/components/ui/basicos";
import { ListaConversaciones } from "../ListaConversaciones";
import { Chat } from "./Chat";

export const metadata = { title: "Chat" };

type Persona = { id: string; nombre: string; foto_path: string | null };

export default function PaginaChat({ params }: PageProps<"/mensajes/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/mensajes/[id]">["params"] }) {
  const { id } = await params;
  const usuario = await exigirUsuario(["comprador", "vendedor"]);
  const supabase = await crearClienteServidor();

  const { data: c } = await supabase
    .from("conversaciones")
    .select(
      "*, comprador:perfiles!conversaciones_comprador_id_fkey(id, nombre, foto_path), vendedor:perfiles!conversaciones_vendedor_id_fkey(id, nombre, foto_path), publicacion:publicaciones(id, nombre, precio)",
    )
    .eq("id", Number(id))
    .maybeSingle();
  if (!c) notFound();

  const { data: mensajes } = await supabase.from("mensajes").select("*").eq("conversacion_id", c.id).order("created_at").limit(500);

  const comprador = c.comprador as unknown as Persona;
  const vendedor = c.vendedor as unknown as Persona;
  const esComprador = usuario.id === comprador.id;
  const otro = esComprador ? vendedor : comprador;
  const publicacion = c.publicacion as { id: number; nombre: string; precio: number } | null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
      <aside className="tarjeta hidden max-h-[calc(100vh-10rem)] overflow-y-auto lg:block">
        <ListaConversaciones usuarioId={usuario.id} activa={c.id} />
      </aside>

      <section className="tarjeta flex h-[calc(100vh-10rem)] min-h-[480px] flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-borde px-4 py-3">
          <Link href="/mensajes" className="text-texto-suave lg:hidden" aria-label="Volver">
            ←
          </Link>
          <Avatar nombre={otro.nombre} path={otro.foto_path} tamano={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{otro.nombre}</p>
            <p className="text-xs text-texto-suave">{esComprador ? "Vendedor" : "Comprador"}</p>
          </div>
          {esComprador && (
            <Link href={`/vendedores/${vendedor.id}`} className="ml-auto text-xs font-medium text-marca hover:underline">
              Ver perfil
            </Link>
          )}
        </header>
        <Chat
          conversacionId={c.id}
          usuarioId={usuario.id}
          iniciales={(mensajes as Mensaje[]) ?? []}
          nombres={{ [comprador.id]: comprador.nombre, [vendedor.id]: vendedor.nombre }}
        />
      </section>

      <aside className="space-y-4">
        {publicacion && (
          <div className="tarjeta p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Publicación consultada</p>
            <Link href={`/publicaciones/${publicacion.id}`} className="mt-1 block font-semibold hover:text-marca">
              {publicacion.nombre}
            </Link>
            <p className="text-sm">{dinero(publicacion.precio)}</p>
          </div>
        )}

      </aside>
    </div>
  );
}
