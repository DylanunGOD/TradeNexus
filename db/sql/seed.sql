-- =====================================================================
-- TradeNexus · Carga inicial de datos (RT-02)
-- Ejecutar DESPUÉS de migrations/001_esquema.sql
--
-- IMPORTANTE: las tiendas afiliadas, direcciones, coordenadas y días de
-- despacho son DATOS DE EJEMPLO. Reemplácenlos por los datos reales que
-- comparta Burro Singles antes de la demo con el cliente.
-- =====================================================================

insert into public.tiendas (nombre, provincia, direccion, horario, dias_despacho, es_ancla, lat, lng) values
  ('Burro Singles',               'San José',   'San José centro (dirección por confirmar)', 'L-S 10:00-19:00', '{2,5}', true,  9.9325, -84.0796),
  ('Punto TN Heredia',            'Heredia',    'Heredia centro (ejemplo)',                 'L-S 10:00-18:00', '{1,4}', false, 9.9981, -84.1170),
  ('Punto TN Alajuela',           'Alajuela',   'Alajuela centro (ejemplo)',                'L-S 10:00-18:00', '{1,4}', false, 10.0163, -84.2116),
  ('Punto TN Cartago',            'Cartago',    'Cartago centro (ejemplo)',                 'L-S 10:00-18:00', '{3}',   false, 9.8644, -83.9194),
  ('Punto TN Liberia',            'Guanacaste', 'Liberia centro (ejemplo)',                 'L-S 09:00-17:00', '{3}',   false, 10.6346, -85.4377),
  ('Punto TN Pérez Zeledón',      'San José',   'San Isidro de El General (ejemplo)',       'L-S 09:00-17:00', '{2}',   false, 9.3734, -83.7038);

insert into public.juegos (nombre, slug, orden) values
  ('Pokémon TCG', 'pokemon', 1),
  ('Magic: The Gathering', 'magic', 2),
  ('Yu-Gi-Oh!', 'yugioh', 3),
  ('One Piece Card Game', 'one-piece', 4),
  ('Disney Lorcana', 'lorcana', 5);

-- Las rarezas cambian según el juego (RF-02)
insert into public.rarezas (juego_id, nombre, orden)
select j.id, r.nombre, r.orden
from public.juegos j
join (values
  ('pokemon', 'Común', 1), ('pokemon', 'Poco común', 2), ('pokemon', 'Rara', 3), ('pokemon', 'Rara holo', 4),
  ('pokemon', 'Doble rara', 5), ('pokemon', 'Ultra rara', 6), ('pokemon', 'Ilustración rara', 7),
  ('pokemon', 'Ilustración especial rara', 8), ('pokemon', 'Hiper rara', 9),
  ('magic', 'Común', 1), ('magic', 'Infrecuente', 2), ('magic', 'Rara', 3), ('magic', 'Mítica', 4),
  ('yugioh', 'Common', 1), ('yugioh', 'Rare', 2), ('yugioh', 'Super Rare', 3), ('yugioh', 'Ultra Rare', 4),
  ('yugioh', 'Secret Rare', 5), ('yugioh', 'Quarter Century Secret Rare', 6), ('yugioh', 'Starlight Rare', 7),
  ('one-piece', 'Común (C)', 1), ('one-piece', 'Infrecuente (UC)', 2), ('one-piece', 'Rara (R)', 3),
  ('one-piece', 'Súper rara (SR)', 4), ('one-piece', 'Secreta (SEC)', 5), ('one-piece', 'Líder (L)', 6),
  ('lorcana', 'Común', 1), ('lorcana', 'Poco común', 2), ('lorcana', 'Rara', 3), ('lorcana', 'Súper rara', 4),
  ('lorcana', 'Legendaria', 5), ('lorcana', 'Encantada', 6)
) as r(slug, nombre, orden) on r.slug = j.slug;
