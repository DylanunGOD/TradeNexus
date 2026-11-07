import { Vacio } from "@/components/ui/basicos";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Vacio
        titulo="No encontramos esta página"
        texto="Puede que no exista o que no tengas permiso para verla."
        accion={{ href: "/", texto: "Volver al catálogo" }}
      />
    </div>
  );
}
