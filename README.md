# TradeNexus

Aplicación web responsive para publicar y vender cartas coleccionables (TCG). Los pedidos se rastrean por tramos a través de la red de tiendas afiliadas hasta el punto de retiro que elige el comprador. Tienda ancla: **Burro Singles**.

> Proyecto académico · Administración de Proyectos · Prof. Marcos Antonio Rodríguez Ovares

Este documento es la **guía técnica** del proyecto. El manual de uso por rol está en [`docs/manual-de-uso.md`](docs/manual-de-uso.md) y el registro de pruebas en [`docs/registro-de-pruebas.md`](docs/registro-de-pruebas.md).

---

## 1. Tecnologías

| Pieza | Tecnología | Para qué se usa |
|---|---|---|
| Interfaz y servidor | **Next.js 16** (App Router) + TypeScript | Páginas, formularios y lógica del servidor en un solo proyecto |
| Estilos | **Tailwind CSS 4** | Diseño responsive (RNF-02) |
| Base de datos | **Supabase** (PostgreSQL) | Tablas, reglas de seguridad (RLS) y funciones de negocio |
| Inicio de sesión | Supabase Auth | Cuentas con correo y contraseña |
| Archivos | Supabase Storage | Fotos de cartas, avatares, comprobantes y evidencias |
| Tiempo real | Supabase Realtime | Chat y campana de notificaciones en vivo |
| Hosting | **Vercel Hobby** | Publicación gratuita (uso académico, no comercial) |

Todo funciona con los planes gratuitos. Si el proyecto llegara a usarse comercialmente, Vercel Hobby ya no aplica (ver sección 8).

---

## 2. Puesta en marcha (paso a paso)

### 2.1 Crear el proyecto en Supabase

1. Creen una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (plan Free). Una región de EE. UU. Este queda bien para Costa Rica.
2. Abran **SQL Editor**, peguen el contenido completo de `db/sql/migrations/001_esquema.sql` y presionen **Run**.
3. En una consulta nueva, peguen `db/sql/seed.sql` y presionen **Run**. Esto carga las tiendas, los juegos y las rarezas.
4. En **Authentication → Sign In / Providers → Email**, desactiven **Confirm email**. El correo de confirmación del plan gratuito tiene un límite muy bajo de envíos por hora y para la demo no hace falta. Si lo dejan activo, la app avisa al usuario que revise su correo.
5. En **Project Settings → API Keys**, copien:
   - la **Project URL**,
   - la **publishable key** (o la *anon key* si su panel todavía la muestra),
   - la **service_role / secret key** (solo para los scripts; es secreta).

> ⚠️ **Importante:** cambien los datos de ejemplo de `seed.sql`. Las tiendas afiliadas, sus direcciones, coordenadas y días de despacho son inventados. Reemplácenlos por los datos reales que comparta Burro Singles (RT-02), ya sea editando el archivo o desde **Administración → Tiendas**.

### 2.2 Correr la aplicación en su computadora

Requisitos: [Node.js 20 o superior](https://nodejs.org).

```bash
npm install
cp .env.example .env.local    # y llenen los tres valores
npm run seed:demo             # crea cuentas de prueba para cada rol
npm run dev                   # abre http://localhost:3000
```

`npm run seed:demo` crea estas cuentas, todas con la contraseña `TradeNexus2026!`:

| Cuenta | Rol |
|---|---|
| `admin@tradenexus.test` | Administrador |
| `soporte@tradenexus.test` | Soporte |
| `burro@tradenexus.test` | Vendedor (Burro Singles) |
| `vendedor@tradenexus.test` | Vendedor tercero (Cartas del Valle, entrega en Cartago) |
| `comprador@tradenexus.test` | Comprador (retira en Heredia) |
| `comprador2@tradenexus.test` | Comprador (retira en Liberia) |
| `tienda1@…` a `tienda6@tradenexus.test` | Personal de cada tienda, en el orden de `seed.sql` (1 = Burro Singles) |

Cambien estas contraseñas o borren las cuentas antes de mostrar la app a usuarios reales.

### 2.3 Publicar en Vercel

1. Suban el proyecto a GitHub (RNF-07).
2. En [vercel.com](https://vercel.com), creen una cuenta Hobby e importen el repositorio. Vercel detecta Next.js solo.
3. En **Environment Variables** agreguen **solo** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **No** agreguen la service_role key.
4. Presionen **Deploy**. Luego, en Supabase → **Authentication → URL Configuration**, pongan la dirección de Vercel (`https://su-proyecto.vercel.app`) como **Site URL**.

Nota sobre el equipo: en el plan Hobby, la cuenta de Vercel es de una sola persona. Si el repositorio es privado, Vercel puede bloquear despliegues hechos con commits de otros integrantes. Lo más simple es que el dueño de la cuenta sea quien haga *merge* a `main`, o usar un repositorio público.

---

## 3. Arquitectura

```
Navegador ──► Next.js (Vercel)
               │  Server Components: leen datos con la sesión del usuario
               │  Server Actions: formularios (crear pedido, validar pago, etc.)
               ▼
            Supabase
               ├─ Auth ............ sesiones (cookies)
               ├─ PostgreSQL ...... tablas + RLS + funciones RPC + triggers
               ├─ Storage ......... 4 buckets con permisos por carpeta
               └─ Realtime ........ mensajes y notificaciones en vivo
```

La decisión más importante es que **la base de datos aplica las reglas de negocio**, no solo la interfaz:

- **Row Level Security (RLS):** cada tabla define quién puede leer y escribir cada fila. Por ejemplo, un comprador no puede leer el chat de otro, aunque arme la consulta a mano.
- **Estados solo por funciones:** nadie puede editar `pedidos.estado` directamente. Cada transición es una función SQL (`confirmar_pedido`, `revisar_pago`, `recibir_en_origen`, `despachar_pedido`, `recibir_en_nodo`, `confirmar_retiro`, `cancelar_pedido`) que verifica el rol, la tienda y el estado anterior.
- **Historial inmutable (RNF-06):** un trigger registra cada cambio de estado en `eventos_pedido` con fecha, hora, nodo y usuario. Otro trigger bloquea cualquier `UPDATE` o `DELETE` sobre esa tabla, incluso si lo intenta un administrador.
- **Notificaciones automáticas (RF-10):** el mismo trigger crea la notificación dentro de la app. No se puede cambiar un estado sin avisar.

### 3.1 Estados de un pedido

```
borrador ─► pendiente_pago ─► pago_en_revision ─► en_lista ─► en_tienda_origen
 (vendedor     (comprador          (vendedor           (tienda de origen
  agrega        adjunta             valida o            confirma recepción
  artículos)    comprobante)        rechaza)            física)
                                                              │
      entregado ◄─ listo_para_retiro ◄─ en_transito ◄─────────┤
   (código OK)    (se genera código)     ▲      │              │
                                         │      ▼              │
                                   en_punto_intermedio ◄───────┘
cancelado: posible desde borrador, pendiente_pago, pago_en_revision o en_lista
```

| Estado | Quién lo cambia | Requisito |
|---|---|---|
| borrador → pendiente_pago | Vendedor | Al menos un artículo |
| pendiente_pago → pago_en_revision | Comprador | Sube el comprobante |
| pago_en_revision → en_lista / pendiente_pago | Vendedor | Rechazar exige un motivo |
| en_lista → en_tienda_origen | Personal de la tienda de origen | **Solo si el pago está validado** |
| → en_transito | Personal de la tienda donde está el paquete | Hay un siguiente punto en la ruta |
| en_transito → en_punto_intermedio / listo_para_retiro | Personal de la tienda que recibe | Al llegar al punto final se genera el código |
| listo_para_retiro → entregado | Personal del punto de retiro | Código de 6 dígitos correcto |

El administrador puede hacer cualquiera de las acciones de tienda y **agregar puntos intermedios** a la ruta antes del primer despacho.

### 3.2 Roles

| Rol | Qué puede hacer |
|---|---|
| Comprador | Ver el catálogo, chatear, crear pedidos, adjuntar comprobantes, seguir el pedido, ver su código de retiro, calificar y denunciar |
| Vendedor | Hasta 5 publicaciones activas con 4 imágenes cada una, llenar y confirmar pedidos, validar pagos y cancelar antes del envío |
| Personal de tienda | Registrar recepción, despacho, llegada y entrega en **su** tienda |
| Soporte | Gestionar denuncias hasta su cierre y ver los strikes |
| Administrador | Todo lo anterior, más roles, tiendas, strikes y relevancia en el meta |

Las personas se registran como comprador o vendedor. Los roles de personal se asignan en **Administración → Usuarios y roles** (RT-03).

### 3.3 Archivos (Storage)

| Bucket | Ruta | Quién lo ve |
|---|---|---|
| `publicaciones` | `{vendedor}/{publicación}/archivo.webp` | Público |
| `avatars` | `{usuario}/archivo.webp` | Público |
| `comprobantes` | `{pedido}/archivo` | **Solo el comprador y el vendedor del pedido** (RNF-05) |
| `evidencias` | `{denuncia}/archivo` | El comprador que denunció, soporte y admin |

Las fotos se comprimen en el navegador (WebP, máximo 1280 px) antes de subirlas, para que el GB gratuito de Supabase alcance para mucho más. La base de datos guarda solo la ruta del archivo.

---

## 4. Estructura del código

```
db/sql/
  migrations/001_esquema.sql ← tablas, RLS, funciones, triggers, buckets
  seed.sql                   ← tiendas, juegos y rarezas iniciales
scripts/
  seed-demo.mjs              ← cuentas y publicaciones de demostración
  prueba-flujo.mjs           ← 64 pruebas automáticas de reglas y seguridad
src/
  proxy.ts                   ← refresca la sesión en cada solicitud
  lib/
    supabase/server.ts       ← cliente para el servidor (usa cookies)
    supabase/client.ts       ← cliente para el navegador (chat, uploads)
    auth.ts                  ← obtenerUsuario() / exigirUsuario(roles)
    formato.ts               ← colones, fechas, nombres de estados
    pedidos.ts               ← ruta del pedido y "siguiente movimiento"
  components/                ← encabezado, campana, tarjetas, seguimiento…
  app/                       ← una carpeta por página
    page.tsx                 ← catálogo con filtros (RF-01 a RF-03)
    publicaciones/[id]       ← detalle y "Contactar al vendedor"
    vendedores/[id]          ← perfil público del vendedor (RF-14)
    vendedor/publicaciones   ← gestión de publicaciones (RF-04)
    mensajes/                ← chat (RN-02)
    pedidos/                 ← lista y detalle con seguimiento (RF-05 a RF-11)
    tienda/                  ← panel logístico de cada tienda (RF-7)
    denuncias/, soporte/     ← denuncias (RF-12)
    admin/                   ← usuarios, tiendas, strikes, pedidos (RF-13, RT-02/03)
    perfil/                  ← perfil e historial de compras (RF-14)
    notificaciones/          ← todas las notificaciones (RF-10)
```

### 4.1 Patrones que se repiten

**Cada página** lee datos dentro de un `<Suspense>`. Next.js 16 tiene *Cache Components* activado y exige esto para todo lo que dependa de la sesión:

```tsx
export default function Pagina({ params }: PageProps<"/pedidos/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}
async function Contenido({ params }) {
  const usuario = await exigirUsuario(["comprador"]);   // redirige si no tiene permiso
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("pedidos").select("*")…
}
```

**Cada formulario** usa `<FormAccion action={…}>`, que llama a una *Server Action* y muestra su error o su mensaje de éxito. Las acciones viven en el archivo `acciones.ts` de cada carpeta y terminan con `refresh()` para mostrar los datos nuevos.

**Los mensajes de error** de las funciones SQL (`raise exception '…'`) ya están en español y se muestran tal cual al usuario.

---

## 5. Requisitos cubiertos

| Requisito | Dónde |
|---|---|
| RF-01 Publicaciones con imágenes | `app/page.tsx`, `app/publicaciones/[id]` |
| RF-02 Filtros por juego y rareza dependiente, orden y etiquetas | `app/FiltrosCatalogo.tsx` |
| RF-03 / RN-09 Relevancia en el meta | Campo `relevancia_meta`, orden "Relevancia en el meta" y ajuste en `admin/publicaciones` |
| RF-04 Máx. 5 publicaciones activas y 4 imágenes | Triggers `validar_publicacion` y `validar_imagenes` |
| RF-05 Gestión de pedidos y cancelación notificada | `app/pedidos`, `cancelar_pedido` |
| RF-6 / RN-06 Punto de retiro = tienda de preferencia | Registro y perfil; el pedido toma ese destino |
| RF-7 "En tienda de origen" solo con recepción física | `recibir_en_origen` (exige pago validado) |
| RF-8 Línea de tiempo, nodo, siguiente movimiento, intermedio vs. final | `components/pedidos/Seguimiento.tsx`, `lib/pedidos.ts` |
| RF-9 / RN-11 Código de retiro | Tabla `codigos_retiro` (solo el comprador la lee) y `confirmar_retiro` |
| RF-10 Notificaciones | Dentro de la app: campana en vivo y página de notificaciones |
| RF-11 Calificación con estrellas | `calificaciones`, vista `vendedores_resumen` |
| RF-12 Denuncias con evidencia | `app/denuncias`, `app/soporte` |
| RF-13 Strikes internos | Tabla `strikes` (solo admin y soporte la leen) |
| RF-14 Perfiles; compras canceladas ocultas tras un botón | `app/perfil`, `app/vendedores/[id]` |
| RN-02 Chat | `app/mensajes/[id]/Chat.tsx` (Realtime) |
| RN-03 / RN-10 Comprobantes; sin datos bancarios | Bucket privado `comprobantes`, `revisar_pago` |
| RNF-05 Acceso por rol | RLS + `exigirUsuario(roles)` |
| RNF-06 Historial inmutable | Trigger `historial_inmutable` |
| RT-02 / RT-03 Carga inicial, cuentas y roles | `seed.sql`, `seed-demo.mjs`, `admin/usuarios`, `admin/tiendas` |

### 5.1 Decisiones y supuestos que conviene validar con el cliente

- **Notificaciones solo dentro de la app.** RF-10 dice "enviará un correo". El equipo decidió dejar el correo fuera del alcance, así que conviene actualizar el texto del requisito en la Delimitación de alcances.
- **"Singles o bases".** Se interpretó como el tipo de producto: *single* = carta individual; *base* = producto sellado o lote. Se puede filtrar por tipo y por etiquetas.
- **Relevancia en el meta.** La indica el vendedor en 4 niveles (sin relevancia, casual, competitivo, top meta) y el administrador puede corregirla. No hay una fuente externa de datos del meta.
- **Una conversación por comprador y vendedor.** De una misma conversación pueden salir varios pedidos.
- **Ruta.** Por defecto, la ruta va de la tienda de origen del vendedor al punto de retiro del comprador. El admin o la tienda de origen pueden agregar puntos intermedios antes del primer despacho.
- **Mapa.** Es un esquema de la red con coordenadas de cada tienda. No hay mapa satelital ni GPS (restricción del alcance).
- **Cancelación por el comprador.** Solo puede cancelar mientras el pedido está en preparación o pendiente de pago. Después, solo el vendedor o el admin, y siempre antes del envío.

---

## 6. Pruebas

```bash
npm run test:flujo
```

El script inicia sesión con las cuentas de demostración y recorre el flujo completo: chat, pedido, comprobante, trazabilidad con punto intermedio, código de retiro, calificación, denuncia y strike. En el camino intenta más de 25 acciones prohibidas y verifica que la base de datos las rechace. Resultado actual: **64 de 64 pruebas correctas**. El detalle está en [`docs/registro-de-pruebas.md`](docs/registro-de-pruebas.md).

Cada ejecución crea pedidos nuevos, así que es mejor correrlo en un proyecto de pruebas y no en el que verá el cliente.

---

## 7. Mantenimiento (RT-05)

- **Cambios en la base de datos:** creen un script nuevo y numerado en `db/sql/migrations/` (002_…, 003_…), avisen al equipo y ejecútenlo en el SQL Editor. No editen la migración inicial una vez que la app esté en uso.
- **Límites del plan gratuito de Supabase:** 500 MB de base de datos, 1 GB de archivos y 5 GB de transferencia al mes. Además, **el proyecto se pausa tras 7 días sin actividad**: revisen el panel antes de cada demo y reactívenlo si hace falta.
- **Antes de entregar:** cambien las contraseñas de las cuentas de demostración y nunca suban `.env.local` a GitHub (ya está en `.gitignore`).

## 8. Si el proyecto crece

Vercel Hobby es solo para uso personal y no comercial. Si TradeNexus llegara a operar para Burro Singles de forma comercial, deberán pasar a Vercel Pro o mudar el hosting (por ejemplo, a Netlify). El código no cambia, solo el lugar donde se publica. Supabase Free sí permite uso comercial, pero tiene los límites de la sección anterior.
