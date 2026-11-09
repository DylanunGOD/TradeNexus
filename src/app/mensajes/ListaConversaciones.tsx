import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHora } from "@/lib/formato";
import { Avatar } from "@/components/ui/basicos";

type Persona = { id: string; nombre: string; foto_path: string | null };

export async function ListaConversaciones({ usuarioId, activa }: { usuarioId: string; activa?: number }) {
  const supabase = await crearClienteServidor();
  const { data: conversaciones } = await supabase
    .from("conversaciones")
    .select(
      "id, ultimo_mensaje_at, comprador:perfiles!conversaciones_comprador_id_fkey(id, nombre, foto_path), vendedor:perfiles!conversaciones_vendedor_id_fkey(id, nombre, foto_path), publicacion:publicaciones(nombre)",
    )
    .order("ultimo_mensaje_at", { ascending: false });

  const ids = (conversaciones ?? []).map((c) => c.id);
  const [{ data: ultimos }, { data: noLeidas }] = await Promise.all([
    ids.length
      ? supabase.from("mensajes").select("conversacion_id, contenido, autor_id").in("conversacion_id", ids).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as { conversacion_id: number; contenido: string; autor_id: string }[] }),
    supabase.from("notificaciones").select("referencia").eq("leida", false).like("referencia", "conversacion:%"),
  ]);
  const ultimo = new Map<number, { contenido: string; autor_id: string }>();
  for (const m of ultimos ?? []) if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m);
  const pendientes = new Set((noLeidas ?? []).map((n) => Number(String(n.referencia).split(":")[1])));

  if (!conversaciones?.length) {
    return <p className="p-4 text-sm text-texto-suave">Aún no tienes conversaciones. Contacta a un vendedor desde una publicación.</p>;
  }

  return (
    <ul className="divide-y divide-borde">
      {conversaciones.map((c) => {
        const comprador = c.comprador as unknown as Persona;
        const vendedor = c.vendedor as unknown as Persona;
        const otro = comprador.id === usuarioId ? vendedor : comprador;
        const m = ultimo.get(c.id);
        const nuevo = pendientes.has(c.id);
        return (
          <li key={c.id}>
            <Link
              href={`/mensajes/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-fondo ${activa === c.id ? "bg-marca-clara/60" : ""}`}
            >
              <Avatar nombre={otro.nombre} path={otro.foto_path} tamano={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-sm ${nuevo ? "font-bold" : "font-semibold"}`}>{otro.nombre}</p>
                  <span className="shrink-0 text-[11px] text-texto-suave">{fechaHora(c.ultimo_mensaje_at)}</span>
                </div>
                <p className={`truncate text-xs ${nuevo ? "font-semibold text-tinta" : "text-texto-suave"}`}>
                  {m ? `${m.autor_id === usuarioId ? "Tú: " : ""}${m.contenido}` : (c.publicacion as unknown as { nombre: string } | null)?.nombre ?? "Conversación nueva"}
                </p>
              </div>
              {nuevo && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-marca" aria-label="Mensajes nuevos" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
