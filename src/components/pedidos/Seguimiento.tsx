import { fechaHora, indiceEstado, PASOS_SEGUIMIENTO } from "@/lib/formato";
import type { NodoRuta } from "@/lib/pedidos";
import type { EstadoPedido, EventoPedido, Pedido, Tienda } from "@/lib/tipos";

/** Línea de tiempo con el estado actual y los pasos completados (RF-8). */
export function PasosPedido({ estado }: { estado: EstadoPedido }) {
  if (estado === "cancelado") return null;
  const actual = indiceEstado(estado);
  // El paso actual es el último cuyo estado ya se alcanzó; los anteriores están completos.
  const pasoActual = PASOS_SEGUIMIENTO.reduce((acc, p, i) => (indiceEstado(p.estado) <= actual ? i : acc), -1);
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
      {PASOS_SEGUIMIENTO.map((paso, i) => {
        const completado = i < pasoActual || estado === "entregado";
        const esActual = i === pasoActual && !completado;
        return (
          <li key={paso.estado} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-3.5 -z-0 h-0.5 w-full ${i % 3 === 0 ? "hidden sm:block" : ""} ${completado || esActual ? "bg-marca" : "bg-borde"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                completado ? "bg-marca text-white" : esActual ? "bg-white text-marca ring-4 ring-marca/30" : "bg-white text-texto-suave ring-2 ring-borde"
              }`}
            >
              {completado ? "✓" : i + 1}
            </span>
            <span className={`mt-1.5 px-1 text-[11px] leading-tight ${esActual ? "font-bold text-marca" : completado ? "font-medium text-tinta" : "text-texto-suave"}`}>
              {paso.texto}
            </span>
            {esActual && <span className="sr-only">(paso actual)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Ruta por la red: distingue tienda de origen, puntos intermedios y punto final (RN-05). */
export function RutaRed({ nodos, pedido }: { nodos: NodoRuta[]; pedido: Pedido }) {
  return (
    <ol className="space-y-0">
      {nodos.map((n, i) => {
        const enCamino = pedido.estado === "en_transito" && pedido.siguiente_nodo_id === n.tienda.id;
        return (
          <li key={n.orden} className="relative flex gap-3 pb-5 last:pb-0">
            {i < nodos.length - 1 && (
              <span className={`absolute left-[11px] top-6 h-full w-0.5 ${n.estado === "completado" ? "bg-marca" : "bg-borde"}`} aria-hidden />
            )}
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                n.estado === "completado"
                  ? "bg-marca text-white"
                  : n.estado === "actual"
                    ? "bg-acento text-tinta ring-4 ring-acento/30"
                    : enCamino
                      ? "animate-pulse bg-violet-200 text-marca"
                      : "bg-white text-texto-suave ring-2 ring-borde"
              }`}
            >
              {n.tipo === "final" ? "★" : n.estado === "completado" ? "✓" : i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {n.tienda.nombre}
                {n.estado === "actual" && <span className="ml-2 rounded-full bg-acento/20 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Aquí está tu pedido</span>}
                {enCamino && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-marca">En camino</span>}
              </p>
              <p className="text-xs text-texto-suave">
                {n.tipo === "origen" ? "Tienda de origen" : n.tipo === "final" ? "Punto final · retiro" : "Punto intermedio"} · {n.tienda.provincia}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Mapa esquemático: muestra solo los nodos de la red, sin rastreo GPS (restricción del alcance). */
export function MapaRed({ nodos, tiendas, actualId }: { nodos: NodoRuta[]; tiendas: Tienda[]; actualId: number | null }) {
  const enRuta = nodos.map((n) => n.tienda).filter((t) => t.lat != null && t.lng != null);
  if (!enRuta.length) return null;
  // El encuadre se ajusta a la ruta (con un margen mínimo) para que los nombres no se encimen.
  const lats = enRuta.map((t) => t.lat!);
  const lngs = enRuta.map((t) => t.lng!);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const span = Math.max(0.35, (Math.max(...lats) - Math.min(...lats)) * 1.5, ((Math.max(...lngs) - Math.min(...lngs)) * 1.5) / 1.45);
  const W = 320;
  const H = 220;
  const x = (lng: number) => W / 2 + ((lng - cLng) / (span * 1.45)) * W;
  const y = (lat: number) => H / 2 - ((lat - cLat) / span) * H;
  const dentro = (t: Tienda) => t.lat != null && t.lng != null && x(t.lng) > 8 && x(t.lng) < W - 8 && y(t.lat) > 8 && y(t.lat) < H - 8;
  const idsRuta = new Set(enRuta.map((t) => t.id));
  const puntos = enRuta.map((t) => `${x(t.lng!)},${y(t.lat!)}`).join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-gradient-to-br from-sky-50 to-marca-clara" role="img" aria-label="Mapa de la red de tiendas con la ruta del pedido">
        <polyline points={puntos} fill="none" stroke="var(--color-marca)" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
        {tiendas.filter(dentro).map((t) => {
          const ruta = idsRuta.has(t.id);
          const actual = t.id === actualId;
          const cx = x(t.lng!);
          const cy = y(t.lat!);
          const izquierda = cx > W * 0.62;
          const indice = enRuta.findIndex((r) => r.id === t.id);
          return (
            <g key={t.id}>
              {actual && <circle cx={cx} cy={cy} r={13} fill="var(--color-acento)" opacity={0.35} />}
              <circle cx={cx} cy={cy} r={actual ? 7 : ruta ? 5.5 : 3.5} fill={actual ? "var(--color-acento)" : ruta ? "var(--color-marca)" : "#b8b3d1"} stroke="white" strokeWidth={1.5} />
              <text
                x={cx + (izquierda ? -10 : 10)}
                y={cy + (indice % 2 === 0 ? -6 : 14)}
                textAnchor={izquierda ? "end" : "start"}
                fontSize={ruta || actual ? 10 : 8.5}
                fontWeight={ruta || actual ? 600 : 400}
                fill={ruta || actual ? "var(--color-tinta)" : "#8a85a8"}
              >
                {t.nombre.replace("Punto TN ", "")}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[11px] text-texto-suave">Ubicación por punto de la red (sin GPS en tiempo real).</figcaption>
    </figure>
  );
}

/** Historial completo con fecha, hora, nodo y responsable (RF-8, RNF-06). */
export function HistorialPedido({
  eventos,
  tiendas,
  nombres,
}: {
  eventos: EventoPedido[];
  tiendas: Map<number, Tienda>;
  nombres: Map<string, string>;
}) {
  return (
    <ol className="space-y-3">
      {[...eventos].reverse().map((e, i) => (
        <li key={e.id} className="flex gap-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-marca" : "bg-borde"}`} aria-hidden />
          <div className="min-w-0 text-sm">
            <p className={i === 0 ? "font-semibold" : ""}>{e.descripcion}</p>
            <p className="text-xs text-texto-suave">
              {fechaHora(e.created_at)}
              {e.tienda_id && ` · ${tiendas.get(e.tienda_id)?.nombre}`}
              {e.usuario_id && ` · por ${nombres.get(e.usuario_id) ?? "usuario"}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
