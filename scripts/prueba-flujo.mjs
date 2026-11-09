// Prueba automatizada del flujo completo de TradeNexus contra Supabase.
// Inicia sesión con las cuentas de demostración y verifica reglas de negocio
// y de seguridad (RLS). Crea datos nuevos en cada ejecución.
//
// Uso:  node --env-file=.env.local scripts/prueba-flujo.mjs
// Requiere haber ejecutado antes scripts/seed-demo.mjs.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const CLAVE = process.env.CLAVE_DEMO || "TradeNexus2026!";

let ok = 0;
let fallos = 0;
function check(descripcion, condicion, detalle = "") {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos++;
    console.log(`  ✗ ${descripcion} ${detalle}`);
  }
}
const seccion = (t) => console.log(`\n▸ ${t}`);

async function sesion(email) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: CLAVE });
  if (error) throw new Error(`${email}: ${error.message}`);
  c.uid = data.user.id;
  return c;
}


const comprador = await sesion("comprador@tradenexus.test");
const vendedor = await sesion("burro@tradenexus.test");
const vendedor2 = await sesion("vendedor@tradenexus.test");

const { data: tiendas } = await comprador.from("tiendas").select("id, nombre");
const idTienda = (n) => tiendas.find((t) => t.nombre.includes(n)).id;

// ---------------------------------------------------------------------
seccion("Perfiles y roles (RNF-05)");
{
  const { error } = await comprador.from("perfiles").update({ rol: "admin" }).eq("id", comprador.uid);
  check("Un comprador no puede darse el rol de administrador", !!error, error ? "" : "(se permitió)");
  const { data } = await comprador.from("perfiles").select("rol").eq("id", comprador.uid).single();
  check("El rol del comprador sigue igual", data.rol === "comprador");
  await comprador.from("perfiles").update({ tienda_preferida_id: idTienda("Heredia") }).eq("id", comprador.uid);
}

// ---------------------------------------------------------------------
seccion("Publicaciones (RF-04)");
{
  const { data: j } = await vendedor.from("juegos").select("id").eq("slug", "pokemon").single();
  const { error } = await vendedor.from("publicaciones").insert({ vendedor_id: vendedor.uid, juego_id: j.id, nombre: "Sexta carta", precio: 1000 });
  check("No se permite una 6.ª publicación activa", error?.message.includes("5 publicaciones"), error?.message);
  const { error: e2 } = await comprador.from("publicaciones").insert({ vendedor_id: comprador.uid, juego_id: j.id, nombre: "No soy vendedor", precio: 1 });
  check("Un comprador no puede publicar", !!e2);
  const { data: mias } = await vendedor.from("publicaciones").select("id").eq("vendedor_id", vendedor.uid).limit(1);
  const { error: e3 } = await vendedor2.from("publicaciones").update({ precio: 1 }).eq("id", mias[0].id).select().single();
  check("Un vendedor no puede editar publicaciones ajenas", !!e3);
  const { data: r } = await vendedor.from("rarezas").select("id").neq("juego_id", j.id).limit(1).single();
  const { error: e4 } = await vendedor.from("publicaciones").update({ rareza_id: r.id }).eq("id", mias[0].id);
  check("La rareza debe corresponder al juego", e4?.message.includes("rareza"), e4?.message);
}

console.log(`\nResultado: ${ok} pruebas correctas, ${fallos} fallidas.`);
process.exit(fallos ? 1 : 0);
