import { Suspense } from "react";
import { exigirUsuario } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DIAS, diasTexto } from "@/lib/formato";
import type { Tienda } from "@/lib/tipos";
import { Cargando } from "@/components/ui/basicos";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { guardarTienda } from "../acciones";

export const metadata = { title: "Tiendas de la red" };

/** Red de tiendas, puntos de retiro y días de despacho (RT-02). */
export default function Tiendas() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

function FormTienda({ t }: { t?: Tienda }) {
  return (
    <FormAccion action={guardarTienda.bind(null, t?.id ?? null)} className="grid gap-3 sm:grid-cols-2">
      <input name="nombre" defaultValue={t?.nombre} required placeholder="Nombre" className="campo" />
      <input name="provincia" defaultValue={t?.provincia} required placeholder="Provincia" className="campo" />
      <input name="direccion" defaultValue={t?.direccion} placeholder="Dirección" className="campo sm:col-span-2" />
      <input name="horario" defaultValue={t?.horario ?? ""} placeholder="Horario (ej. L-S 10:00-18:00)" className="campo" />
      <input name="telefono" defaultValue={t?.telefono ?? ""} placeholder="Teléfono" className="campo" />
      <input name="lat" defaultValue={t?.lat ?? ""} placeholder="Latitud (mapa)" className="campo" inputMode="decimal" />
      <input name="lng" defaultValue={t?.lng ?? ""} placeholder="Longitud (mapa)" className="campo" inputMode="decimal" />
      <fieldset className="sm:col-span-2">
        <legend className="etiqueta">Días de despacho</legend>
        <div className="flex flex-wrap gap-3">
          {DIAS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 text-sm capitalize">
              <input type="checkbox" name="dias_despacho" value={i} defaultChecked={t?.dias_despacho.includes(i)} className="accent-marca" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="es_punto_retiro" defaultChecked={t?.es_punto_retiro ?? true} className="accent-marca" /> Es punto de retiro
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activa" defaultChecked={t?.activa ?? true} className="accent-marca" /> Activa
      </label>
      <div className="sm:col-span-2">
        <BotonEnviar className="btn-primario">{t ? "Guardar cambios" : "Agregar tienda"}</BotonEnviar>
      </div>
    </FormAccion>
  );
}

async function Contenido() {
  await exigirUsuario(["admin"]);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("tiendas").select("*").order("es_ancla", { ascending: false }).order("nombre");

  return (
    <div className="space-y-5">
      <h1 className="titulo-pagina">Tiendas de la red</h1>
      <ul className="space-y-3">
        {((data as Tienda[]) ?? []).map((t) => (
          <li key={t.id} className="tarjeta">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="font-semibold">
                    {t.nombre} {t.es_ancla && <span className="chip ml-1 border-acento bg-amber-50 text-amber-900">Tienda ancla</span>}
                    {!t.activa && <span className="chip ml-1">Inactiva</span>}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {t.provincia} · despacha {diasTexto(t.dias_despacho)} · {t.es_punto_retiro ? "punto de retiro" : "solo tránsito"}
                  </p>
                </div>
                <span className="text-sm font-medium text-marca">Editar</span>
              </summary>
              <div className="border-t border-borde p-4">
                <FormTienda t={t} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section className="tarjeta p-5">
        <h2 className="mb-4 font-semibold">Agregar tienda afiliada</h2>
        <FormTienda />
      </section>
    </div>
  );
}
