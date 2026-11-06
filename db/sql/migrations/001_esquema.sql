-- =====================================================================
-- TradeNexus · Esquema de base de datos (Supabase / PostgreSQL)
-- ---------------------------------------------------------------------
-- Cómo usarlo: en el panel de Supabase abran "SQL Editor", peguen este
-- archivo completo y presionen "Run". Luego ejecuten seed.sql.
--
-- Principios del diseño:
--   * Toda tabla tiene Row Level Security (RLS): la base de datos decide
--     quién puede leer o escribir cada fila, no solo la interfaz.
--   * Los cambios de estado de un pedido SOLO ocurren mediante funciones
--     (RPC) que validan rol y estado. Nadie puede editar "estado" directo.
--   * Cada cambio de estado se registra automáticamente en
--     eventos_pedido, una tabla que no permite UPDATE ni DELETE (RNF-06).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('comprador', 'vendedor', 'tienda', 'soporte', 'admin');

create type public.estado_pedido as enum (
  'borrador',            -- creado desde el chat; el vendedor agrega los artículos
  'pendiente_pago',      -- vendedor confirmó; falta el comprobante
  'pago_en_revision',    -- comprador adjuntó comprobante
  'en_lista',            -- pago validado; el vendedor debe llevarlo a la tienda de origen
  'en_tienda_origen',    -- la tienda de origen confirmó la recepción física
  'en_transito',         -- viajando entre dos nodos de la red
  'en_punto_intermedio', -- llegó a un punto intermedio
  'listo_para_retiro',   -- llegó al punto final; se genera el código
  'entregado',
  'cancelado'
);

create type public.tipo_producto as enum ('single', 'base');
create type public.estado_publicacion as enum ('activa', 'retirada');
create type public.estado_denuncia as enum ('abierta', 'en_revision', 'resuelta', 'cerrada');

-- ---------------------------------------------------------------------
-- Catálogos: tiendas de la red, juegos y rarezas
-- ---------------------------------------------------------------------
create table public.tiendas (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  provincia      text not null,
  direccion      text not null default '',
  telefono       text,
  horario        text,
  -- Días de despacho: 0 = domingo, 1 = lunes ... 6 = sábado
  dias_despacho  smallint[] not null default '{}',
  es_punto_retiro boolean not null default true,
  es_ancla       boolean not null default false,
  lat            double precision,
  lng            double precision,
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.juegos (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  slug   text not null unique,
  orden  smallint not null default 0
);

create table public.rarezas (
  id       bigint generated always as identity primary key,
  juego_id bigint not null references public.juegos on delete cascade,
  nombre   text not null,
  orden    smallint not null default 0,
  unique (juego_id, nombre)
);

-- ---------------------------------------------------------------------
-- Perfiles (uno por usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id                  uuid primary key references auth.users on delete cascade,
  nombre              text not null,
  rol                 public.rol_usuario not null default 'comprador',
  -- Comprador: tienda de preferencia = punto de retiro (RN-06)
  tienda_preferida_id bigint references public.tiendas,
  -- Vendedor: tienda donde entrega sus paquetes (tienda de origen)
  -- Personal de tienda: tienda donde trabaja
  tienda_id           bigint references public.tiendas,
  foto_path           text,
  bio                 text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funciones auxiliares de permisos (se usan en las políticas RLS)
-- SECURITY DEFINER: leen perfiles sin quedar atrapadas en RLS.
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.tiene_rol(variadic roles public.rol_usuario[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = any (roles) from public.perfiles where id = auth.uid()), false)
$$;

create or replace function public.mi_tienda()
returns bigint language sql stable security definer set search_path = public as $$
  select tienda_id from public.perfiles where id = auth.uid()
$$;

-- Crea el perfil automáticamente cuando alguien se registra.
-- Solo se permite elegir "comprador" o "vendedor"; los roles de personal
-- (tienda, soporte, admin) los asigna un administrador (RT-03).
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol public.rol_usuario := 'comprador';
begin
  if new.raw_user_meta_data ->> 'rol' = 'vendedor' then
    v_rol := 'vendedor';
  end if;
  insert into public.perfiles (id, nombre, rol, tienda_preferida_id, tienda_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    v_rol,
    nullif(new.raw_user_meta_data ->> 'tienda_preferida_id', '')::bigint,
    case when v_rol = 'vendedor' then nullif(new.raw_user_meta_data ->> 'tienda_id', '')::bigint end
  );
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Un usuario no puede cambiarse su propio rol ni (si es personal de tienda) su tienda.
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.tiene_rol('admin') then
    if new.rol is distinct from old.rol then
      raise exception 'Solo un administrador puede cambiar roles';
    end if;
    if old.rol <> 'vendedor' and new.tienda_id is distinct from old.tienda_id then
      raise exception 'Solo un administrador puede cambiar la tienda asignada';
    end if;
  end if;
  return new;
end $$;

create trigger proteger_perfil
  before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------------
-- Publicaciones (RF-01 a RF-04)
-- ---------------------------------------------------------------------
create table public.publicaciones (
  id              bigint generated always as identity primary key,
  vendedor_id     uuid not null references public.perfiles on delete cascade,
  juego_id        bigint not null references public.juegos,
  rareza_id       bigint references public.rarezas,
  nombre          text not null check (char_length(nombre) between 2 and 120),
  descripcion     text not null default '' check (char_length(descripcion) <= 2000),
  precio          numeric(12, 2) not null check (precio >= 0),
  tipo            public.tipo_producto not null default 'single',
  -- Relevancia en el meta competitivo: 0 = sin relevancia ... 3 = top meta
  relevancia_meta smallint not null default 0 check (relevancia_meta between 0 and 3),
  etiquetas       text[] not null default '{}',
  estado          public.estado_publicacion not null default 'activa',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index publicaciones_catalogo_idx on public.publicaciones (estado, juego_id, created_at desc);
create index publicaciones_vendedor_idx on public.publicaciones (vendedor_id);

create table public.publicacion_imagenes (
  id             bigint generated always as identity primary key,
  publicacion_id bigint not null references public.publicaciones on delete cascade,
  path           text not null,
  orden          smallint not null default 0,
  created_at     timestamptz not null default now()
);
create index publicacion_imagenes_pub_idx on public.publicacion_imagenes (publicacion_id, orden);

-- Reglas de negocio de RF-04: máximo 5 publicaciones activas y 4 imágenes.
create or replace function public.validar_publicacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rareza_id is not null and not exists (
    select 1 from public.rarezas where id = new.rareza_id and juego_id = new.juego_id
  ) then
    raise exception 'La rareza seleccionada no corresponde al juego';
  end if;

  if new.estado = 'activa' and (tg_op = 'INSERT' or old.estado <> 'activa') then
    if (select count(*) from public.publicaciones
        where vendedor_id = new.vendedor_id and estado = 'activa'
          and id is distinct from new.id) >= 5 then
      raise exception 'Solo puedes tener 5 publicaciones activas a la vez. Retira una para publicar otra.';
    end if;
  end if;

  new.etiquetas := array(select distinct lower(trim(e)) from unnest(new.etiquetas) e where trim(e) <> '');
  new.updated_at := now();
  return new;
end $$;

create trigger validar_publicacion
  before insert or update on public.publicaciones
  for each row execute function public.validar_publicacion();

create or replace function public.validar_imagenes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.publicacion_imagenes where publicacion_id = new.publicacion_id) >= 4 then
    raise exception 'Cada publicación admite como máximo 4 imágenes';
  end if;
  return new;
end $$;

create trigger validar_imagenes
  before insert on public.publicacion_imagenes
  for each row execute function public.validar_imagenes();

-- ---------------------------------------------------------------------
-- Chat comprador-vendedor (RN-02)
-- ---------------------------------------------------------------------
create table public.conversaciones (
  id                 bigint generated always as identity primary key,
  comprador_id       uuid not null references public.perfiles on delete cascade,
  vendedor_id        uuid not null references public.perfiles on delete cascade,
  publicacion_id     bigint references public.publicaciones on delete set null,
  ultimo_mensaje_at  timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (comprador_id, vendedor_id),
  check (comprador_id <> vendedor_id)
);

create table public.mensajes (
  id              bigint generated always as identity primary key,
  conversacion_id bigint not null references public.conversaciones on delete cascade,
  autor_id        uuid not null default auth.uid() references public.perfiles on delete cascade,
  contenido       text not null check (char_length(trim(contenido)) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index mensajes_conversacion_idx on public.mensajes (conversacion_id, created_at);

-- ---------------------------------------------------------------------
-- Notificaciones dentro de la aplicación (RF-10)
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles on delete cascade,
  tipo        text not null,          -- pedido | mensaje | denuncia | sistema
  titulo      text not null,
  mensaje     text not null default '',
  enlace      text,
  referencia  text,                   -- p. ej. 'conversacion:12' para agrupar mensajes
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida, created_at desc);

-- Uso interno (no expuesta a la API).
create or replace function public.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_mensaje text, p_enlace text, p_referencia text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null then return; end if;
  -- Los mensajes de chat se agrupan: si ya hay una notificación sin leer
  -- de la misma conversación, se actualiza en vez de crear otra.
  if p_referencia is not null then
    update public.notificaciones
       set titulo = p_titulo, mensaje = p_mensaje, created_at = now()
     where usuario_id = p_usuario and referencia = p_referencia and not leida;
    if found then return; end if;
  end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, enlace, referencia)
  values (p_usuario, p_tipo, p_titulo, p_mensaje, p_enlace, p_referencia);
end $$;

create or replace function public.al_enviar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.conversaciones;
  v_destino uuid;
  v_autor text;
begin
  select * into c from public.conversaciones where id = new.conversacion_id;
  update public.conversaciones set ultimo_mensaje_at = new.created_at where id = c.id;
  v_destino := case when new.autor_id = c.comprador_id then c.vendedor_id else c.comprador_id end;
  select nombre into v_autor from public.perfiles where id = new.autor_id;
  perform public.notificar(
    v_destino, 'mensaje', 'Nuevo mensaje de ' || v_autor,
    left(new.contenido, 120), '/mensajes/' || c.id, 'conversacion:' || c.id
  );
  return new;
end $$;

create trigger al_enviar_mensaje
  after insert on public.mensajes
  for each row execute function public.al_enviar_mensaje();

-- ---------------------------------------------------------------------
-- Pedidos, artículos, ruta y trazabilidad (RF-05 a RF-09, RN-03 a RN-05)
-- ---------------------------------------------------------------------
create table public.pedidos (
  id                    bigint generated always as identity primary key,
  comprador_id          uuid not null references public.perfiles,
  vendedor_id           uuid not null references public.perfiles,
  conversacion_id       bigint references public.conversaciones on delete set null,
  tienda_origen_id      bigint not null references public.tiendas,
  tienda_destino_id     bigint not null references public.tiendas,
  estado                public.estado_pedido not null default 'borrador',
  nodo_actual_id        bigint references public.tiendas,
  siguiente_nodo_id     bigint references public.tiendas,
  ruta_indice           smallint not null default 0,
  total                 numeric(12, 2) not null default 0,
  comprobante_path      text,
  comprobante_subido_at timestamptz,
  motivo_rechazo_pago   text,
  motivo_cancelacion    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index pedidos_comprador_idx on public.pedidos (comprador_id, created_at desc);
create index pedidos_vendedor_idx on public.pedidos (vendedor_id, created_at desc);

create table public.pedido_items (
  id              bigint generated always as identity primary key,
  pedido_id       bigint not null references public.pedidos on delete cascade,
  publicacion_id  bigint references public.publicaciones on delete set null,
  descripcion     text not null check (char_length(descripcion) between 1 and 200),
  cantidad        integer not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0)
);

-- Ruta del pedido por la red: orden 0 = tienda de origen, la última = punto de retiro.
create table public.pedido_ruta (
  pedido_id bigint not null references public.pedidos on delete cascade,
  orden     smallint not null,
  tienda_id bigint not null references public.tiendas,
  primary key (pedido_id, orden)
);

-- Historial inmutable de estados (RNF-06)
create table public.eventos_pedido (
  id          bigint generated always as identity primary key,
  pedido_id   bigint not null references public.pedidos,
  estado      public.estado_pedido not null,
  tienda_id   bigint references public.tiendas,
  descripcion text not null,
  usuario_id  uuid references public.perfiles,
  created_at  timestamptz not null default now()
);
create index eventos_pedido_idx on public.eventos_pedido (pedido_id, created_at);

-- El código de retiro vive aparte para que solo el comprador pueda leerlo.
create table public.codigos_retiro (
  pedido_id  bigint primary key references public.pedidos on delete cascade,
  codigo     text not null,
  created_at timestamptz not null default now()
);

create or replace function public.bloquear_cambios_historial()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial de trazabilidad no se puede modificar ni eliminar';
end $$;

create trigger historial_inmutable
  before update or delete on public.eventos_pedido
  for each row execute function public.bloquear_cambios_historial();

-- ¿Puede el usuario actual ver este pedido? (comprador, vendedor, personal
-- de una tienda en la ruta, soporte o admin)
create or replace function public.puede_ver_pedido(p_pedido bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pedidos p
    where p.id = p_pedido
      and (
        p.comprador_id = auth.uid()
        or p.vendedor_id = auth.uid()
        or public.tiene_rol('admin', 'soporte')
        or (public.tiene_rol('tienda') and exists (
              select 1 from public.pedido_ruta r
              where r.pedido_id = p.id and r.tienda_id = public.mi_tienda()))
      )
  )
$$;

create or replace function public.nombre_tienda(p_id bigint)
returns text language sql stable security definer set search_path = public as $$
  select nombre from public.tiendas where id = p_id
$$;

create or replace function public.recalcular_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pedido bigint := coalesce(new.pedido_id, old.pedido_id);
begin
  update public.pedidos
     set total = coalesce((select sum(cantidad * precio_unitario) from public.pedido_items where pedido_id = v_pedido), 0),
         updated_at = now()
   where id = v_pedido;
  return null;
end $$;

create trigger recalcular_total
  after insert or update or delete on public.pedido_items
  for each row execute function public.recalcular_total();

-- Registra el evento y envía las notificaciones de cada cambio de estado.
-- Las funciones RPC pueden dejar una nota (motivo) con:
--   set_config('tradenexus.nota', 'texto', true)
create or replace function public.registrar_evento_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nota    text := nullif(current_setting('tradenexus.nota', true), '');
  v_desc    text;
  v_tienda  bigint := new.nodo_actual_id;
  v_codigo  text := 'TN-' || lpad(new.id::text, 6, '0');
  v_enlace  text := '/pedidos/' || new.id;
  v_comprador text;
  v_staff   uuid;
begin
  if tg_op = 'UPDATE' and new.estado = old.estado
     and new.nodo_actual_id is not distinct from old.nodo_actual_id then
    return new;
  end if;

  v_desc := case new.estado
    when 'borrador' then 'Pedido creado desde el chat. El vendedor está agregando los artículos.'
    when 'pendiente_pago' then
      case when tg_op = 'UPDATE' and old.estado = 'pago_en_revision'
           then 'El vendedor rechazó el comprobante' || coalesce(': ' || v_nota, '.') || ' Adjunta un comprobante válido.'
           else 'El vendedor confirmó el pedido. Falta adjuntar el comprobante de pago.' end
    when 'pago_en_revision' then 'El comprador adjuntó el comprobante de pago. El vendedor lo está revisando.'
    when 'en_lista' then 'Pago validado. El vendedor entregará el paquete en ' || public.nombre_tienda(new.tienda_origen_id) || '.'
    when 'en_tienda_origen' then public.nombre_tienda(new.nodo_actual_id) || ' confirmó la recepción física del paquete.'
    when 'en_transito' then 'Salió de ' || public.nombre_tienda(new.nodo_actual_id) || ' hacia ' || public.nombre_tienda(new.siguiente_nodo_id) || '.'
    when 'en_punto_intermedio' then 'Llegó al punto intermedio ' || public.nombre_tienda(new.nodo_actual_id) || '.'
    when 'listo_para_retiro' then 'Llegó al punto de retiro ' || public.nombre_tienda(new.nodo_actual_id) || '. Ya puedes retirarlo con tu código.'
    when 'entregado' then 'Pedido entregado en ' || public.nombre_tienda(new.nodo_actual_id) || '.'
    when 'cancelado' then 'Pedido cancelado' || coalesce(': ' || v_nota, '.')
  end;

  if new.estado = 'en_lista' then v_tienda := new.tienda_origen_id; end if;

  insert into public.eventos_pedido (pedido_id, estado, tienda_id, descripcion, usuario_id)
  values (new.id, new.estado, v_tienda, v_desc, auth.uid());

  -- Notificaciones
  select nombre into v_comprador from public.perfiles where id = new.comprador_id;

  if new.estado = 'borrador' then
    perform public.notificar(new.vendedor_id, 'pedido', 'Nuevo pedido ' || v_codigo,
      v_comprador || ' creó un pedido. Agrega los artículos y confírmalo.', v_enlace);
  else
    if auth.uid() is distinct from new.comprador_id then
      perform public.notificar(new.comprador_id, 'pedido',
        case new.estado
          when 'listo_para_retiro' then '¡Tu pedido ' || v_codigo || ' está listo para retiro!'
          when 'cancelado' then 'Pedido ' || v_codigo || ' cancelado'
          else 'Pedido ' || v_codigo || ' actualizado' end,
        v_desc, v_enlace);
    end if;
    if new.estado in ('pago_en_revision', 'en_tienda_origen', 'entregado', 'cancelado')
       and auth.uid() is distinct from new.vendedor_id then
      perform public.notificar(new.vendedor_id, 'pedido', 'Pedido ' || v_codigo || ' actualizado', v_desc, v_enlace);
    end if;
    -- Avisar al personal de la tienda que debe actuar
    if new.estado in ('en_lista', 'en_transito') then
      for v_staff in
        select id from public.perfiles
        where rol = 'tienda'
          and tienda_id = case when new.estado = 'en_lista' then new.tienda_origen_id else new.siguiente_nodo_id end
      loop
        perform public.notificar(v_staff, 'pedido',
          case when new.estado = 'en_lista' then 'Paquete por recibir: ' || v_codigo
               else 'Paquete en camino a tu tienda: ' || v_codigo end,
          v_desc, '/tienda');
      end loop;
    end if;
  end if;

  perform set_config('tradenexus.nota', '', true);
  return new;
end $$;

create trigger registrar_evento_pedido
  after insert or update on public.pedidos
  for each row execute function public.registrar_evento_pedido();

-- ---------------------------------------------------------------------
-- Reputación, denuncias y strikes (RF-11 a RF-13, RN-07, RN-08)
-- ---------------------------------------------------------------------
create table public.calificaciones (
  id           bigint generated always as identity primary key,
  pedido_id    bigint not null unique references public.pedidos on delete cascade,
  comprador_id uuid not null default auth.uid() references public.perfiles,
  vendedor_id  uuid references public.perfiles,
  estrellas    smallint not null check (estrellas between 1 and 5),
  comentario   text check (char_length(comentario) <= 500),
  created_at   timestamptz not null default now()
);
create index calificaciones_vendedor_idx on public.calificaciones (vendedor_id);

create or replace function public.completar_calificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select vendedor_id into new.vendedor_id from public.pedidos where id = new.pedido_id;
  return new;
end $$;

create trigger completar_calificacion
  before insert on public.calificaciones
  for each row execute function public.completar_calificacion();

create table public.denuncias (
  id           bigint generated always as identity primary key,
  pedido_id    bigint not null references public.pedidos,
  comprador_id uuid not null default auth.uid() references public.perfiles,
  vendedor_id  uuid references public.perfiles,
  motivo       text not null,
  descripcion  text not null check (char_length(descripcion) between 10 and 3000),
  estado       public.estado_denuncia not null default 'abierta',
  asignado_a   uuid references public.perfiles,
  resolucion   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.denuncia_evidencias (
  id          bigint generated always as identity primary key,
  denuncia_id bigint not null references public.denuncias on delete cascade,
  path        text not null,
  nombre      text,
  created_at  timestamptz not null default now()
);

create table public.denuncia_comentarios (
  id          bigint generated always as identity primary key,
  denuncia_id bigint not null references public.denuncias on delete cascade,
  autor_id    uuid not null default auth.uid() references public.perfiles,
  contenido   text not null check (char_length(trim(contenido)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create or replace function public.al_crear_denuncia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select vendedor_id into new.vendedor_id from public.pedidos where id = new.pedido_id;
  return new;
end $$;

create trigger al_crear_denuncia
  before insert on public.denuncias
  for each row execute function public.al_crear_denuncia();

create or replace function public.avisar_denuncia_nueva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid;
begin
  for v_staff in select id from public.perfiles where rol in ('soporte', 'admin') loop
    perform public.notificar(v_staff, 'denuncia', 'Nueva denuncia #' || new.id,
      new.motivo || ' · Pedido TN-' || lpad(new.pedido_id::text, 6, '0'), '/soporte/' || new.id);
  end loop;
  return new;
end $$;

create trigger avisar_denuncia_nueva
  after insert on public.denuncias
  for each row execute function public.avisar_denuncia_nueva();

create or replace function public.al_comentar_denuncia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d public.denuncias;
begin
  select * into d from public.denuncias where id = new.denuncia_id;
  if new.autor_id = d.comprador_id then
    if d.asignado_a is not null then
      perform public.notificar(d.asignado_a, 'denuncia', 'Nuevo comentario en la denuncia #' || d.id,
        left(new.contenido, 120), '/soporte/' || d.id);
    end if;
  else
    perform public.notificar(d.comprador_id, 'denuncia', 'Soporte respondió tu denuncia #' || d.id,
      left(new.contenido, 120), '/denuncias/' || d.id);
  end if;
  update public.denuncias set updated_at = now() where id = d.id;
  return new;
end $$;

create trigger al_comentar_denuncia
  after insert on public.denuncia_comentarios
  for each row execute function public.al_comentar_denuncia();

-- Registro interno: NO visible para compradores (RF-13)
create table public.strikes (
  id          bigint generated always as identity primary key,
  vendedor_id uuid not null references public.perfiles on delete cascade,
  admin_id    uuid not null default auth.uid() references public.perfiles,
  denuncia_id bigint references public.denuncias on delete set null,
  motivo      text not null check (char_length(motivo) between 5 and 1000),
  created_at  timestamptz not null default now()
);

-- Resumen público del vendedor (RF-14): estrellas, pedidos y ventas.
-- Es una vista con permisos del dueño: expone solo conteos, nunca pedidos.
create view public.vendedores_resumen as
select
  p.id,
  p.nombre,
  p.foto_path,
  p.bio,
  p.tienda_id,
  p.created_at,
  coalesce(round(avg(c.estrellas)::numeric, 1), 0) as estrellas,
  count(c.id) as total_calificaciones,
  (select count(*) from public.pedidos x where x.vendedor_id = p.id and x.estado not in ('borrador', 'cancelado')) as pedidos,
  (select count(*) from public.pedidos x where x.vendedor_id = p.id and x.estado = 'entregado') as ventas
from public.perfiles p
left join public.calificaciones c on c.vendedor_id = p.id
where p.rol = 'vendedor'
group by p.id;

-- =====================================================================
-- Funciones RPC (las llama la aplicación con supabase.rpc(...))
-- =====================================================================

create or replace function public.iniciar_conversacion(p_vendedor uuid, p_publicacion bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  if not public.tiene_rol('comprador') then
    raise exception 'Solo los compradores pueden iniciar conversaciones con vendedores';
  end if;
  if not exists (select 1 from public.perfiles where id = p_vendedor and rol = 'vendedor') then
    raise exception 'El usuario indicado no es un vendedor';
  end if;
  insert into public.conversaciones (comprador_id, vendedor_id, publicacion_id)
  values (auth.uid(), p_vendedor, p_publicacion)
  on conflict (comprador_id, vendedor_id)
  do update set publicacion_id = coalesce(excluded.publicacion_id, conversaciones.publicacion_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.crear_pedido(p_conversacion bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  c public.conversaciones;
  v_origen bigint;
  v_destino bigint;
  v_id bigint;
begin
  select * into c from public.conversaciones where id = p_conversacion;
  if not found or c.comprador_id <> auth.uid() then
    raise exception 'Solo el comprador de la conversación puede crear el pedido';
  end if;
  select tienda_preferida_id into v_destino from public.perfiles where id = auth.uid();
  if v_destino is null then
    raise exception 'Primero selecciona tu tienda de preferencia (punto de retiro) en tu perfil';
  end if;
  select tienda_id into v_origen from public.perfiles where id = c.vendedor_id;
  if v_origen is null then
    raise exception 'El vendedor todavía no tiene una tienda de origen asignada';
  end if;

  insert into public.pedidos (comprador_id, vendedor_id, conversacion_id, tienda_origen_id, tienda_destino_id)
  values (auth.uid(), c.vendedor_id, c.id, v_origen, v_destino)
  returning id into v_id;

  insert into public.pedido_ruta (pedido_id, orden, tienda_id) values (v_id, 0, v_origen);
  if v_destino <> v_origen then
    insert into public.pedido_ruta (pedido_id, orden, tienda_id) values (v_id, 1, v_destino);
  end if;
  return v_id;
end $$;

create or replace function public.confirmar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found or p.vendedor_id <> auth.uid() then raise exception 'Solo el vendedor puede confirmar el pedido'; end if;
  if p.estado <> 'borrador' then raise exception 'El pedido ya fue confirmado'; end if;
  if not exists (select 1 from public.pedido_items where pedido_id = p_pedido) then
    raise exception 'Agrega al menos un artículo antes de confirmar';
  end if;
  update public.pedidos set estado = 'pendiente_pago', updated_at = now() where id = p_pedido;
end $$;

create or replace function public.registrar_comprobante(p_pedido bigint, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found or p.comprador_id <> auth.uid() then raise exception 'Solo el comprador puede adjuntar el comprobante'; end if;
  if p.estado <> 'pendiente_pago' then raise exception 'Este pedido no está esperando un comprobante'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_pedido::text then raise exception 'Ruta de comprobante inválida'; end if;
  update public.pedidos
     set estado = 'pago_en_revision', comprobante_path = p_path, comprobante_subido_at = now(),
         motivo_rechazo_pago = null, updated_at = now()
   where id = p_pedido;
end $$;

create or replace function public.revisar_pago(p_pedido bigint, p_aprobado boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found or p.vendedor_id <> auth.uid() then raise exception 'Solo el vendedor puede validar el pago'; end if;
  if p.estado <> 'pago_en_revision' then raise exception 'No hay un comprobante pendiente de revisión'; end if;
  if p_aprobado then
    update public.pedidos set estado = 'en_lista', updated_at = now() where id = p_pedido;
  else
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo del rechazo'; end if;
    perform set_config('tradenexus.nota', trim(p_motivo), true);
    update public.pedidos set estado = 'pendiente_pago', motivo_rechazo_pago = trim(p_motivo), updated_at = now()
     where id = p_pedido;
  end if;
end $$;

create or replace function public.cancelar_pedido(p_pedido bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la cancelación'; end if;
  if p.estado not in ('borrador', 'pendiente_pago', 'pago_en_revision', 'en_lista') then
    raise exception 'El pedido ya fue enviado y no se puede cancelar';
  end if;
  if not (p.vendedor_id = auth.uid()
          or public.tiene_rol('admin')
          or (p.comprador_id = auth.uid() and p.estado in ('borrador', 'pendiente_pago'))) then
    raise exception 'No tienes permiso para cancelar este pedido';
  end if;
  perform set_config('tradenexus.nota', trim(p_motivo), true);
  update public.pedidos set estado = 'cancelado', motivo_cancelacion = trim(p_motivo), updated_at = now()
   where id = p_pedido;
end $$;

create or replace function public.definir_ruta(p_pedido bigint, p_paradas bigint[])
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
  v_orden smallint := 1;
  v_parada bigint;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or (public.tiene_rol('tienda') and public.mi_tienda() = p.tienda_origen_id)) then
    raise exception 'Solo un administrador o la tienda de origen pueden definir la ruta';
  end if;
  if p.estado not in ('borrador', 'pendiente_pago', 'pago_en_revision', 'en_lista', 'en_tienda_origen') then
    raise exception 'La ruta solo se puede cambiar antes del primer despacho';
  end if;
  delete from public.pedido_ruta where pedido_id = p_pedido;
  insert into public.pedido_ruta values (p_pedido, 0, p.tienda_origen_id);
  foreach v_parada in array coalesce(p_paradas, '{}') loop
    if v_parada <> p.tienda_origen_id and v_parada <> p.tienda_destino_id then
      insert into public.pedido_ruta values (p_pedido, v_orden, v_parada);
      v_orden := v_orden + 1;
    end if;
  end loop;
  if p.tienda_destino_id <> p.tienda_origen_id then
    insert into public.pedido_ruta values (p_pedido, v_orden, p.tienda_destino_id);
  end if;
end $$;

-- Personal de la tienda de origen confirma que recibió el paquete (RF-7)
create or replace function public.recibir_en_origen(p_pedido bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or (public.tiene_rol('tienda') and public.mi_tienda() = p.tienda_origen_id)) then
    raise exception 'Solo la tienda de origen puede confirmar la recepción';
  end if;
  if p.estado <> 'en_lista' then
    raise exception 'El pedido no puede pasar a "en tienda de origen" sin un comprobante validado';
  end if;
  update public.pedidos
     set estado = 'en_tienda_origen', nodo_actual_id = p.tienda_origen_id, ruta_indice = 0, updated_at = now()
   where id = p_pedido;
  -- Si el origen es también el punto de retiro, queda listo de una vez.
  if (select count(*) from public.pedido_ruta where pedido_id = p_pedido) = 1 then
    insert into public.codigos_retiro (pedido_id, codigo)
    values (p_pedido, lpad((floor(random() * 1000000))::int::text, 6, '0'))
    on conflict (pedido_id) do nothing;
    update public.pedidos set estado = 'listo_para_retiro', updated_at = now() where id = p_pedido;
  end if;
end $$;

create or replace function public.despachar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
  v_siguiente bigint;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or (public.tiene_rol('tienda') and public.mi_tienda() = p.nodo_actual_id)) then
    raise exception 'Solo la tienda donde está el paquete puede despacharlo';
  end if;
  if p.estado not in ('en_tienda_origen', 'en_punto_intermedio') then
    raise exception 'El pedido no está listo para despacharse';
  end if;
  select tienda_id into v_siguiente from public.pedido_ruta where pedido_id = p_pedido and orden = p.ruta_indice + 1;
  if v_siguiente is null then raise exception 'No hay un siguiente punto en la ruta'; end if;
  update public.pedidos set estado = 'en_transito', siguiente_nodo_id = v_siguiente, updated_at = now() where id = p_pedido;
end $$;

create or replace function public.recibir_en_nodo(p_pedido bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
  v_es_final boolean;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or (public.tiene_rol('tienda') and public.mi_tienda() = p.siguiente_nodo_id)) then
    raise exception 'Solo la tienda que recibe el paquete puede registrar la llegada';
  end if;
  if p.estado <> 'en_transito' then raise exception 'El pedido no está en tránsito'; end if;
  v_es_final := p.siguiente_nodo_id = p.tienda_destino_id;
  if v_es_final then
    insert into public.codigos_retiro (pedido_id, codigo)
    values (p_pedido, lpad((floor(random() * 1000000))::int::text, 6, '0'))
    on conflict (pedido_id) do nothing;
  end if;
  update public.pedidos
     set estado = case when v_es_final then 'listo_para_retiro'::public.estado_pedido else 'en_punto_intermedio' end,
         nodo_actual_id = p.siguiente_nodo_id, siguiente_nodo_id = null,
         ruta_indice = p.ruta_indice + 1, updated_at = now()
   where id = p_pedido;
end $$;

-- La tienda de retiro ingresa el código que presenta el comprador (RF-9)
create or replace function public.confirmar_retiro(p_pedido bigint, p_codigo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or (public.tiene_rol('tienda') and public.mi_tienda() = p.tienda_destino_id)) then
    raise exception 'Solo el punto de retiro puede confirmar la entrega';
  end if;
  if p.estado <> 'listo_para_retiro' then raise exception 'El pedido no está listo para retiro'; end if;
  if not exists (select 1 from public.codigos_retiro where pedido_id = p_pedido and codigo = trim(p_codigo)) then
    raise exception 'Código incorrecto';
  end if;
  update public.pedidos set estado = 'entregado', updated_at = now() where id = p_pedido;
end $$;

create or replace function public.gestionar_denuncia(p_denuncia bigint, p_estado public.estado_denuncia, p_resolucion text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.denuncias;
begin
  if not public.tiene_rol('soporte', 'admin') then raise exception 'Solo el personal de soporte puede gestionar denuncias'; end if;
  select * into d from public.denuncias where id = p_denuncia for update;
  if not found then raise exception 'Denuncia no encontrada'; end if;
  if d.estado = 'cerrada' then raise exception 'La denuncia ya está cerrada'; end if;
  if p_estado in ('resuelta', 'cerrada') and coalesce(trim(p_resolucion), trim(d.resolucion), '') = '' then
    raise exception 'Escribe la resolución antes de resolver o cerrar la denuncia';
  end if;
  update public.denuncias
     set estado = p_estado,
         asignado_a = coalesce(d.asignado_a, auth.uid()),
         resolucion = coalesce(nullif(trim(p_resolucion), ''), d.resolucion),
         updated_at = now()
   where id = p_denuncia;
  perform public.notificar(d.comprador_id, 'denuncia', 'Tu denuncia #' || d.id || ' cambió de estado',
    'Nuevo estado: ' || replace(p_estado::text, '_', ' '), '/denuncias/' || d.id);
end $$;

create or replace function public.asignar_rol(p_usuario uuid, p_rol public.rol_usuario, p_tienda bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo un administrador puede asignar roles'; end if;
  if p_rol = 'tienda' and p_tienda is null then raise exception 'El personal de tienda necesita una tienda asignada'; end if;
  if p_usuario = auth.uid() and p_rol <> 'admin' then raise exception 'No puedes quitarte tu propio rol de administrador'; end if;
  update public.perfiles
     set rol = p_rol,
         tienda_id = case when p_rol in ('tienda', 'vendedor') then coalesce(p_tienda, tienda_id) else null end
   where id = p_usuario;
end $$;

create or replace function public.marcar_notificaciones_leidas()
returns void language sql security definer set search_path = public as $$
  update public.notificaciones set leida = true where usuario_id = auth.uid() and not leida
$$;

-- Funciones internas: no deben poder llamarse desde la API
revoke execute on function public.notificar(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.tiendas enable row level security;
alter table public.juegos enable row level security;
alter table public.rarezas enable row level security;
alter table public.perfiles enable row level security;
alter table public.publicaciones enable row level security;
alter table public.publicacion_imagenes enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.notificaciones enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedido_ruta enable row level security;
alter table public.eventos_pedido enable row level security;
alter table public.codigos_retiro enable row level security;
alter table public.calificaciones enable row level security;
alter table public.denuncias enable row level security;
alter table public.denuncia_evidencias enable row level security;
alter table public.denuncia_comentarios enable row level security;
alter table public.strikes enable row level security;

-- Catálogos: lectura pública, edición solo admin
create policy "tiendas: lectura pública" on public.tiendas for select using (true);
create policy "tiendas: admin gestiona" on public.tiendas for all to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));
create policy "juegos: lectura pública" on public.juegos for select using (true);
create policy "juegos: admin gestiona" on public.juegos for all to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));
create policy "rarezas: lectura pública" on public.rarezas for select using (true);
create policy "rarezas: admin gestiona" on public.rarezas for all to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));

-- Perfiles: nombre, foto y tienda son públicos; cada quien edita el suyo
create policy "perfiles: lectura pública" on public.perfiles for select using (true);
create policy "perfiles: editar el propio" on public.perfiles for update to authenticated
  using (id = auth.uid() or public.tiene_rol('admin'))
  with check (id = auth.uid() or public.tiene_rol('admin'));

-- Publicaciones
create policy "publicaciones: ver activas o propias" on public.publicaciones for select
  using (estado = 'activa' or vendedor_id = auth.uid() or public.tiene_rol('admin', 'soporte'));
create policy "publicaciones: vendedor crea" on public.publicaciones for insert to authenticated
  with check (vendedor_id = auth.uid() and public.tiene_rol('vendedor'));
create policy "publicaciones: vendedor edita las suyas" on public.publicaciones for update to authenticated
  using (vendedor_id = auth.uid() or public.tiene_rol('admin'))
  with check (vendedor_id = auth.uid() or public.tiene_rol('admin'));

create policy "imagenes: ver si se ve la publicación" on public.publicacion_imagenes for select
  using (exists (select 1 from public.publicaciones p where p.id = publicacion_id));
create policy "imagenes: dueño agrega" on public.publicacion_imagenes for insert to authenticated
  with check (exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.vendedor_id = auth.uid()));
create policy "imagenes: dueño elimina" on public.publicacion_imagenes for delete to authenticated
  using (exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.vendedor_id = auth.uid()));

-- Chat: solo los participantes
create policy "conversaciones: participantes" on public.conversaciones for select to authenticated
  using (auth.uid() in (comprador_id, vendedor_id));
create policy "mensajes: participantes leen" on public.mensajes for select to authenticated
  using (exists (select 1 from public.conversaciones c where c.id = conversacion_id and auth.uid() in (c.comprador_id, c.vendedor_id)));
create policy "mensajes: participantes escriben" on public.mensajes for insert to authenticated
  with check (autor_id = auth.uid() and exists (
    select 1 from public.conversaciones c where c.id = conversacion_id and auth.uid() in (c.comprador_id, c.vendedor_id)));

-- Notificaciones: cada quien las suyas (solo puede marcar "leida")
create policy "notificaciones: propias" on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());
create policy "notificaciones: marcar leídas" on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke update on public.notificaciones from anon, authenticated;
grant update (leida) on public.notificaciones to authenticated;

-- Pedidos: lectura según participación. Escritura SOLO vía funciones RPC.
create policy "pedidos: involucrados" on public.pedidos for select to authenticated
  using (public.puede_ver_pedido(id));
create policy "items: involucrados" on public.pedido_items for select to authenticated
  using (public.puede_ver_pedido(pedido_id));
create policy "items: vendedor arma el borrador" on public.pedido_items for all to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and p.vendedor_id = auth.uid() and p.estado = 'borrador'))
  with check (exists (select 1 from public.pedidos p where p.id = pedido_id and p.vendedor_id = auth.uid() and p.estado = 'borrador'));
create policy "ruta: involucrados" on public.pedido_ruta for select to authenticated
  using (public.puede_ver_pedido(pedido_id));
create policy "eventos: involucrados" on public.eventos_pedido for select to authenticated
  using (public.puede_ver_pedido(pedido_id));
create policy "codigo: solo el comprador" on public.codigos_retiro for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id and p.comprador_id = auth.uid()));
revoke update, delete on public.eventos_pedido from anon, authenticated;

-- Calificaciones: públicas; el comprador califica un pedido entregado
create policy "calificaciones: lectura pública" on public.calificaciones for select using (true);
create policy "calificaciones: comprador de pedido entregado" on public.calificaciones for insert to authenticated
  with check (comprador_id = auth.uid() and exists (
    select 1 from public.pedidos p where p.id = pedido_id and p.comprador_id = auth.uid() and p.estado = 'entregado'));

-- Denuncias: el comprador que la creó, soporte y admin
create policy "denuncias: comprador y soporte" on public.denuncias for select to authenticated
  using (comprador_id = auth.uid() or public.tiene_rol('soporte', 'admin'));
create policy "denuncias: comprador crea" on public.denuncias for insert to authenticated
  with check (comprador_id = auth.uid() and exists (
    select 1 from public.pedidos p where p.id = pedido_id and p.comprador_id = auth.uid() and p.estado <> 'borrador'));
create policy "evidencias: ver" on public.denuncia_evidencias for select to authenticated
  using (exists (select 1 from public.denuncias d where d.id = denuncia_id));
create policy "evidencias: comprador adjunta" on public.denuncia_evidencias for insert to authenticated
  with check (exists (select 1 from public.denuncias d where d.id = denuncia_id and d.comprador_id = auth.uid()));
create policy "comentarios: ver" on public.denuncia_comentarios for select to authenticated
  using (exists (select 1 from public.denuncias d where d.id = denuncia_id));
create policy "comentarios: comprador o soporte" on public.denuncia_comentarios for insert to authenticated
  with check (autor_id = auth.uid() and exists (
    select 1 from public.denuncias d where d.id = denuncia_id and d.estado <> 'cerrada'
      and (d.comprador_id = auth.uid() or public.tiene_rol('soporte', 'admin'))));

-- Strikes: internos
create policy "strikes: personal interno lee" on public.strikes for select to authenticated
  using (public.tiene_rol('admin', 'soporte'));
create policy "strikes: admin registra" on public.strikes for insert to authenticated
  with check (public.tiene_rol('admin') and admin_id = auth.uid()
    and exists (select 1 from public.perfiles v where v.id = vendedor_id and v.rol = 'vendedor'));

grant select on public.vendedores_resumen to anon, authenticated;

-- =====================================================================
-- Storage: buckets y permisos de archivos
--   publicaciones/{uid}/{publicacion}/{archivo}  → público
--   avatars/{uid}/{archivo}                      → público
--   comprobantes/{pedido}/{archivo}              → solo comprador y vendedor del pedido (RNF-05)
--   evidencias/{denuncia}/{archivo}              → comprador de la denuncia, soporte y admin
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('publicaciones', 'publicaciones', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('evidencias', 'evidencias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Supabase pide permiso de lectura además del de borrado para eliminar archivos.
create policy "imagenes públicas: lectura" on storage.objects for select
  using (bucket_id in ('publicaciones', 'avatars'));
create policy "publicaciones: dueño sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "publicaciones: dueño borra" on storage.objects for delete to authenticated
  using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: dueño sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: dueño actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: dueño borra" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "comprobantes: comprador sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and exists (
    select 1 from public.pedidos p
    where p.id::text = (storage.foldername(name))[1] and p.comprador_id = auth.uid() and p.estado = 'pendiente_pago'));
create policy "comprobantes: comprador y vendedor ven" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and exists (
    select 1 from public.pedidos p
    where p.id::text = (storage.foldername(name))[1] and auth.uid() in (p.comprador_id, p.vendedor_id)));

create policy "evidencias: comprador sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and exists (
    select 1 from public.denuncias d
    where d.id::text = (storage.foldername(name))[1] and d.comprador_id = auth.uid()));
create policy "evidencias: comprador y soporte ven" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and exists (
    select 1 from public.denuncias d
    where d.id::text = (storage.foldername(name))[1]
      and (d.comprador_id = auth.uid() or public.tiene_rol('soporte', 'admin'))));

-- =====================================================================
-- Realtime: el chat y la campana de notificaciones se actualizan en vivo
-- =====================================================================
alter publication supabase_realtime add table public.mensajes, public.notificaciones;
