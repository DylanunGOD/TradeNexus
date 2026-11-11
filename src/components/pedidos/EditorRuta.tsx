import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { definirRuta } from "@/app/tienda/acciones";
import type { Tienda } from "@/lib/tipos";

/**
 * Permite al admin o a la tienda de origen agregar puntos intermedios a la
 * ruta antes del primer despacho. Las paradas se recorren en el orden en
 * que aparecen marcadas en la lista.
 */
export function EditorRuta({ pedidoId, tiendas, seleccionadas }: { pedidoId: number; tiendas: Tienda[]; seleccionadas: number[] }) {
  if (!tiendas.length) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-marca hover:underline">Editar puntos intermedios</summary>
      <FormAccion action={definirRuta.bind(null, pedidoId)} className="mt-3 space-y-2">
        <p className="ayuda">Marca las tiendas por las que pasará el paquete, en el orden de la lista.</p>
        {tiendas.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paradas" value={t.id} defaultChecked={seleccionadas.includes(t.id)} className="h-4 w-4 accent-marca" />
            {t.nombre} <span className="text-xs text-texto-suave">· {t.provincia}</span>
          </label>
        ))}
        <BotonEnviar className="btn-secundario mt-2 w-full">Guardar ruta</BotonEnviar>
      </FormAccion>
    </details>
  );
}
