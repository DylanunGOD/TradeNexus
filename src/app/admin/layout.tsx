import Link from "next/link";

const SECCIONES = [
  { href: "/admin", texto: "Resumen" },
  { href: "/admin/usuarios", texto: "Usuarios y roles" },
  { href: "/admin/pedidos", texto: "Pedidos" },
  { href: "/admin/publicaciones", texto: "Publicaciones" },
  { href: "/admin/tiendas", texto: "Tiendas" },
  { href: "/admin/strikes", texto: "Strikes" },
];

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className="space-y-6">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Administración">
        {SECCIONES.map((s) => (
          <Link key={s.href} href={s.href} className="shrink-0 rounded-xl border border-borde bg-white px-3 py-1.5 text-sm font-medium text-tinta-suave hover:border-marca hover:text-marca">
            {s.texto}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
