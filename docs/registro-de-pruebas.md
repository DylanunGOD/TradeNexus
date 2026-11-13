# Registro de pruebas · TradeNexus

Fecha de ejecución: _(completar al correr `npm run test:flujo`)_.

## 1. Pruebas automáticas de reglas de negocio y seguridad

**Script:** `npm run test:flujo` (`scripts/prueba-flujo.mjs`)

Inicia sesión con una cuenta real de cada rol y ejecuta el flujo completo contra la base de datos. Cada prueba de "no puede" intenta la acción prohibida y verifica que PostgreSQL (RLS o funciones) la rechace.

**Resultado: 64 de 64 correctas.**

```
▸ Perfiles y roles (RNF-05)
  ✓ Un comprador no puede darse el rol de administrador
  ✓ El rol del comprador sigue igual

▸ Publicaciones (RF-04)
  ✓ No se permite una 6.ª publicación activa
  ✓ Un comprador no puede publicar
  ✓ Un vendedor no puede editar publicaciones ajenas
  ✓ La rareza debe corresponder al juego

▸ Chat y creación del pedido (RN-02)
  ✓ El comprador inicia una conversación
  ✓ Otro comprador no puede leer el chat ajeno
  ✓ El vendedor recibió la notificación del mensaje
  ✓ El comprador crea el pedido vacío desde el chat
  ✓ El comprador no puede llenar el pedido
  ✓ No se puede confirmar un pedido sin artículos
  ✓ El vendedor agrega los artículos
  ✓ El total se calcula automáticamente (₡90 000)
  ✓ El vendedor confirma el pedido
  ✓ Tras confirmar, ya no se pueden cambiar los artículos
  ✓ Nadie puede cambiar el estado directamente (solo vía RPC)

▸ Comprobante de pago (RN-03, RNF-05)
  ✓ Sin comprobante validado no pasa a "en tienda de origen"
  ✓ Otro comprador no puede subir comprobantes a este pedido
  ✓ El comprador sube el comprobante
  ✓ El comprador registra el comprobante
  ✓ El vendedor puede ver el comprobante
  ✓ Un tercero NO puede ver el comprobante
  ✓ La tienda NO puede ver el comprobante
  ✓ Rechazar exige un motivo
  ✓ El vendedor rechaza el comprobante con motivo
  ✓ El vendedor valida el pago → "en lista"
  ✓ El comprador ya no puede cancelar un pedido pagado

▸ Trazabilidad por la red (RF-7, RF-8, RN-04, RN-05)
  ✓ Una tienda distinta a la de origen no puede recibirlo
  ✓ El admin agrega un punto intermedio a la ruta
  ✓ La tienda de origen confirma la recepción física
  ✓ La tienda de origen despacha hacia el punto intermedio
  ✓ Solo la tienda destino del tramo puede registrar la llegada
  ✓ Llega al punto intermedio (Alajuela)
  ✓ Estado = "en_punto_intermedio"
  ✓ Llega al punto de retiro (Heredia)
  ✓ Estado = "listo_para_retiro"

▸ Código de retiro (RF-9, RN-11)
  ✓ El comprador ve su código de 6 dígitos
  ✓ Ni el vendedor ni la tienda pueden leer el código
  ✓ Un código incorrecto es rechazado
  ✓ Con el código correcto pasa a "entregado"

▸ Historial inmutable (RNF-06)
  ✓ Se registraron 12 eventos con fecha, hora y usuario
  ✓ Cada evento tiene usuario responsable
  ✓ Ni el admin puede modificar el historial
  ✓ Ni el admin puede borrar el historial
  ✓ El comprador recibió la notificación de listo para retiro

▸ Reputación (RF-11)
  ✓ El comprador califica al vendedor
  ✓ Solo se califica una vez por pedido
  ✓ Las estrellas y ventas son públicas en el perfil

▸ Denuncias y strikes (RF-12, RF-13)
  ✓ El comprador presenta una denuncia
  ✓ Adjunta evidencia
  ✓ Otro comprador no ve la denuncia
  ✓ El vendedor no ve la denuncia
  ✓ Soporte ve la evidencia
  ✓ No se puede cerrar sin resolución
  ✓ Soporte gestiona la denuncia hasta su cierre
  ✓ El comprador no puede gestionar denuncias
  ✓ Soporte no puede registrar strikes (solo admin)
  ✓ El admin registra un strike
  ✓ Los compradores NO ven los strikes
  ✓ Soporte sí ve los strikes

▸ Cancelación antes del envío (RF-05)
  ✓ Cancelar exige un motivo
  ✓ El vendedor cancela antes del envío
  ✓ La cancelación se notifica al comprador

Resultado: 64 pruebas correctas, 0 fallidas.
```

## 2. Prueba de punta a punta por la interfaz

**Herramienta:** Playwright (navegador Chromium automatizado), vista de escritorio 1280 × 900 y móvil 390 × 844.

| # | Escenario | Resultado |
|---|---|---|
| 1 | Visitante ve el catálogo, filtra por juego y ordena por relevancia en el meta | ✓ |
| 2 | Registro de un comprador nuevo eligiendo su tienda de preferencia | ✓ |
| 3 | Comprador abre una publicación, contacta al vendedor, envía un mensaje y crea el pedido | ✓ |
| 4 | Vendedor ve la conversación, agrega un artículo desde su publicación y confirma | ✓ |
| 5 | Comprador sube el comprobante de pago | ✓ |
| 6 | Vendedor ve el comprobante (archivo privado) y valida el pago | ✓ |
| 7 | Personal de la tienda de origen confirma la recepción física y despacha | ✓ |
| 8 | Comprador ve el seguimiento: paso actual, siguiente movimiento, ruta y mapa | ✓ |
| 9 | Personal del punto de retiro registra la llegada | ✓ |
| 10 | Comprador ve su código de retiro | ✓ |
| 11 | La tienda ingresa un código incorrecto (se rechaza) y luego el correcto (entregado) | ✓ |
| 12 | Comprador califica con 5 estrellas y presenta una denuncia con evidencia | ✓ |
| 13 | Soporte comenta y resuelve la denuncia | ✓ |
| 14 | Admin registra un strike y revisa usuarios, tiendas y logística | ✓ |
| 15 | Un comprador que entra a /admin/strikes es redirigido sin acceso | ✓ |
| 16 | Vendedor con 5 publicaciones activas ve "Límite alcanzado", retira una y crea otra con foto | ✓ |
| 17 | Catálogo y detalle del pedido en un teléfono | ✓ |

No hubo errores en la consola del navegador durante la prueba.

## 3. Limitaciones del entorno de prueba

Las pruebas se ejecutaron contra los componentes reales de Supabase que sí se pueden correr localmente (PostgreSQL 16, Supabase Auth y PostgREST), con el mismo esquema SQL que se usará en la nube. Dos piezas no estaban disponibles en ese entorno:

- **Storage:** se usó un emulador que aplica las mismas políticas RLS de `storage.objects`. Conviene repetir la subida de fotos y comprobantes en el proyecto real de Supabase.
- **Realtime:** el chat y la campana se probaron recargando la página. **La actualización en vivo (sin recargar) debe verificarse en el proyecto real de Supabase**: abrir el mismo chat en dos navegadores con cuentas distintas y comprobar que los mensajes aparecen solos.

## 4. Pruebas pendientes con usuarios (criterio de aceptación de usabilidad)

| Prueba | Cómo hacerla | Responsable | Resultado |
|---|---|---|---|
| Un comprador completa una compra sin ayuda | Darle una cuenta y pedirle que compre una carta y siga su pedido | | |
| Un vendedor publica una carta con fotos sin ayuda | | | |
| Personal de Burro Singles registra recepción y entrega | | | |
| Chat en tiempo real en Supabase | Dos navegadores, dos cuentas | | |
| Compatibilidad Chrome y Edge actuales (RNF-04) | Recorrer el flujo en ambos | | |
