import Link from "next/link";
import { Suspense } from "react";
import { BotonEnviar, FormAccion } from "@/components/ui/FormAccion";
import { iniciarSesion } from "../acciones";

export const metadata = { title: "Iniciar sesión" };

export default function PaginaLogin({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md">
      <div className="tarjeta p-6 sm:p-8">
        <h1 className="titulo-pagina">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-texto-suave">Bienvenido de vuelta a TradeNexus.</p>
        <Suspense>
          <Formulario searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-center text-sm text-texto-suave">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="enlace">
            Crear una cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

async function Formulario({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { destino } = await searchParams;
  return (
    <FormAccion action={iniciarSesion} className="mt-6 space-y-4">
      <input type="hidden" name="destino" value={typeof destino === "string" ? destino : "/"} />
      <div>
        <label htmlFor="email" className="etiqueta">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="campo" />
      </div>
      <div>
        <label htmlFor="password" className="etiqueta">
          Contraseña
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="campo" />
      </div>
      <BotonEnviar className="btn-primario w-full" textoEnviando="Ingresando…">
        Ingresar
      </BotonEnviar>
    </FormAccion>
  );
}
