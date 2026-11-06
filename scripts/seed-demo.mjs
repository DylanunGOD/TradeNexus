// Crea cuentas de demostración para cada rol y publicaciones de ejemplo (RT-02, RT-03).
//
// Uso:  node --env-file=.env.local scripts/seed-demo.mjs
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (la "service_role key" está en Supabase → Project Settings → API Keys).
// ¡Nunca publiquen la service_role key ni la usen en el código del navegador!

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const CLAVE = process.env.CLAVE_DEMO || "TradeNexus2026!";

const { data: tiendas, error: errTiendas } = await db.from("tiendas").select("id, nombre").order("id");
if (errTiendas || !tiendas?.length) {
  console.error("No hay tiendas. ¿Ejecutaron db/sql/seed.sql?", errTiendas?.message);
  process.exit(1);
}
const tienda = (nombre) => tiendas.find((t) => t.nombre.includes(nombre))?.id;

const cuentas = [
  { email: "admin@tradenexus.test", nombre: "Administración TradeNexus", rol: "admin" },
  { email: "soporte@tradenexus.test", nombre: "Soporte TradeNexus", rol: "soporte" },
  { email: "burro@tradenexus.test", nombre: "Burro Singles", rol: "vendedor", tienda_id: tienda("Burro") },
  { email: "vendedor@tradenexus.test", nombre: "Cartas del Valle", rol: "vendedor", tienda_id: tienda("Cartago") },
  { email: "comprador@tradenexus.test", nombre: "Ana Rodríguez", rol: "comprador", tienda_preferida_id: tienda("Heredia") },
  { email: "comprador2@tradenexus.test", nombre: "Luis Mora", rol: "comprador", tienda_preferida_id: tienda("Liberia") },
  ...tiendas.map((t, i) => ({
    email: `tienda${i + 1}@tradenexus.test`,
    nombre: `Personal · ${t.nombre}`,
    rol: "tienda",
    tienda_id: t.id,
  })),
];

const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
const existentes = new Map((lista?.users ?? []).map((u) => [u.email, u.id]));
const ids = {};

for (const c of cuentas) {
  let id = existentes.get(c.email);
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: c.email,
      password: CLAVE,
      email_confirm: true,
      user_metadata: { nombre: c.nombre },
    });
    if (error) throw new Error(`${c.email}: ${error.message}`);
    id = data.user.id;
  }
  const { error } = await db
    .from("perfiles")
    .update({ nombre: c.nombre, rol: c.rol, tienda_id: c.tienda_id ?? null, tienda_preferida_id: c.tienda_preferida_id ?? null })
    .eq("id", id);
  if (error) throw new Error(`perfil ${c.email}: ${error.message}`);
  ids[c.email] = id;
  console.log(`✓ ${c.rol.padEnd(9)} ${c.email}`);
}

// Publicaciones de ejemplo (sin imágenes: la app muestra un marcador)
const { data: juegos } = await db.from("juegos").select("id, slug");
const { data: rarezas } = await db.from("rarezas").select("id, juego_id, nombre");
const j = (slug) => juegos.find((x) => x.slug === slug).id;
const r = (slug, nombre) => rarezas.find((x) => x.juego_id === j(slug) && x.nombre === nombre)?.id ?? null;

const publicaciones = {
  "burro@tradenexus.test": [
    ["pokemon", "Ilustración especial rara", "Charizard ex (Obsidian Flames)", 85000, "single", 3, ["pokemon", "charizard", "near-mint"], "Carta en estado near mint, guardada en sleeve y toploader desde que se abrió."],
    ["pokemon", "Doble rara", "Gardevoir ex", 9500, "single", 3, ["pokemon", "competitivo", "staple"], "Pieza central de varias listas competitivas actuales. Estado near mint."],
    ["magic", "Mítica", "Ragavan, Nimble Pilferer", 42000, "single", 3, ["magic", "modern", "staple"], "Versión de Modern Horizons 2. Sin jugar."],
    ["yugioh", "Starlight Rare", "Ash Blossom & Joyous Spring", 120000, "single", 2, ["yugioh", "staple", "coleccion"], "Starlight rare en excelente estado, ideal para colección."],
    ["one-piece", null, "Booster box OP-09 (sellada)", 68000, "base", 0, ["one-piece", "sellado", "booster"], "Caja sellada de fábrica con 24 sobres."],
  ],
  "vendedor@tradenexus.test": [
    ["pokemon", "Rara holo", "Pikachu holo (colección personal)", 6500, "single", 0, ["pokemon", "pikachu", "coleccion"], "Holo con leve desgaste en las esquinas (lightly played)."],
    ["magic", "Rara", "The One Ring", 38000, "single", 3, ["magic", "modern", "competitivo"], "Edición The Lord of the Rings: Tales of Middle-earth. Near mint."],
    ["lorcana", "Encantada", "Elsa – Spirit of Winter (Encantada)", 95000, "single", 1, ["lorcana", "encantada", "coleccion"], "Carta encantada recién abierta, directo a protector."],
    ["yugioh", null, "Starter deck sellado", 9000, "base", 0, ["yugioh", "sellado", "principiantes"], "Ideal para empezar a jugar. Sellado."],
  ],
};

for (const [email, lista] of Object.entries(publicaciones)) {
  const vendedor = ids[email];
  const { count } = await db.from("publicaciones").select("id", { count: "exact", head: true }).eq("vendedor_id", vendedor);
  if (count) continue;
  for (const [slug, rareza, nombre, precio, tipo, meta, etiquetas, descripcion] of lista) {
    const { error } = await db.from("publicaciones").insert({
      vendedor_id: vendedor,
      juego_id: j(slug),
      rareza_id: rareza ? r(slug, rareza) : null,
      nombre,
      precio,
      tipo,
      relevancia_meta: meta,
      etiquetas,
      descripcion,
    });
    if (error) throw new Error(`${nombre}: ${error.message}`);
  }
  console.log(`✓ ${lista.length} publicaciones para ${email}`);
}

console.log(`\nListo. Todas las cuentas usan la contraseña: ${CLAVE}`);
