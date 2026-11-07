import Link from "next/link";
import { Suspense } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Cargando } from "@/components/ui/basicos";
import type { Tienda } from "@/lib/tipos";
import { FormularioRegistro } from "./FormularioRegistro";

export const metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="tarjeta p-6 sm:p-8">
        <h1 className="titulo-pagina">Crear cuenta</h1>
        <p className="mt-1 text-sm text-texto-suave">Compra o vende cartas con seguimiento por la red de tiendas.</p>
        <Suspense fallback={<Cargando />}>
          <Contenido />
        </Suspense>
        <p className="mt-6 text-center text-sm text-texto-suave">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="enlace">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

async function Contenido() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("tiendas").select("*").eq("activa", true).order("es_ancla", { ascending: false }).order("nombre");
  return <FormularioRegistro tiendas={(data as Tienda[]) ?? []} />;
}
