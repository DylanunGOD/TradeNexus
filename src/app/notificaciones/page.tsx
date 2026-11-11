import Link from "next/link";
import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHora } from "@/lib/formato";
import type { Notificacion } from "@/lib/tipos";
import { Cargando, Vacio } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { marcarTodasLeidas } from "./acciones";

export const metadata = { title: "Notificaciones" };

const ICONOS: Record<string, string> = { pedido: "📦", mensaje: "💬", denuncia: "⚠️", sistema: "🔔" };

export default function PaginaNotificaciones() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await exigirUsuario();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(100);
  const notificaciones = (data as Notificacion[]) ?? [];
  const pendientes = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Notificaciones</h1>
          <p className="mt-1 text-sm text-texto-suave">{pendientes ? `${pendientes} sin leer` : "Estás al día"}</p>
        </div>
        {pendientes > 0 && (
          <FormAccion action={marcarTodasLeidas}>
            <BotonEnviar className="btn-secundario" textoEnviando="…">
              Marcar todas como leídas
            </BotonEnviar>
          </FormAccion>
        )}
      </div>
      {notificaciones.length === 0 ? (
        <Vacio titulo="No tienes notificaciones" texto="Aquí verás los cambios de estado de tus pedidos, mensajes nuevos y respuestas de soporte." />
      ) : (
        <ul className="tarjeta divide-y divide-borde overflow-hidden">
          {notificaciones.map((n) => {
            const contenido = (
              <div className={`flex gap-3 px-4 py-3 ${n.leida ? "" : "bg-marca-clara/50"}`}>
                <span className="text-lg" aria-hidden>
                  {ICONOS[n.tipo] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.leida ? "font-medium" : "font-bold"}`}>{n.titulo}</p>
                  {n.mensaje && <p className="text-sm text-tinta-suave">{n.mensaje}</p>}
                  <p className="mt-0.5 text-xs text-texto-suave">{fechaHora(n.created_at)}</p>
                </div>
                {!n.leida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-marca" aria-label="Sin leer" />}
              </div>
            );
            return <li key={n.id}>{n.enlace ? <Link href={n.enlace} className="block hover:bg-fondo">{contenido}</Link> : contenido}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
