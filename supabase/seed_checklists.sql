-- =============================================================================
-- SMU Maintenance Cloud - Checklist Seed Data
-- File: supabase/seed_checklists.sql
-- =============================================================================
-- Global checklist templates (org_id = NULL) for:
--   1. pv_prev  — Preventive maintenance for photovoltaic / PMGD sites
--   2. diesel_prev — Preventive maintenance for diesel generator sites
--
-- Run this in the Supabase Dashboard SQL Editor AFTER the initial schema
-- migration (00001_initial_schema.sql) has been applied.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SAFETY: Idempotent execution guard
-- Skip seed if global templates already exist to prevent duplicate items.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM checklist_templates
    WHERE org_id IS NULL
      AND type IN ('pv_prev', 'diesel_prev')
  ) THEN
    RAISE NOTICE 'Global checklist templates already exist. Seed skipped.';
    RETURN;
  END IF;
END;
$$;


-- =============================================================================
-- TEMPLATE 1: pv_prev — Mantenimiento Preventivo Fotovoltaico / PMGD
-- =============================================================================

WITH tmpl AS (
  INSERT INTO checklist_templates (id, org_id, type, name, version, is_active)
  VALUES (
    gen_random_uuid(),
    NULL,                                         -- global template
    'pv_prev',
    'Mantenimiento Preventivo FV/PMGD - v1',
    1,
    true
  )
  RETURNING id
)
INSERT INTO checklist_items (id, template_id, label, order_index, item_type, options, required)
SELECT
  gen_random_uuid(),
  tmpl.id,
  item.label,
  item.order_index,
  item.item_type,
  item.options,
  item.required
FROM tmpl
CROSS JOIN (VALUES
  -- -------------------------------------------------------------------------
  -- SECCION A: Inspección General del Sitio
  -- -------------------------------------------------------------------------
  (1,  'El sitio se encuentra limpio y despejado de vegetación',                               'bool',   NULL,                                              true),
  (2,  'Vallado perimetral en buen estado (sin daños ni accesos no autorizados)',               'bool',   NULL,                                              true),
  (3,  'Señalética de seguridad visible y legible',                                            'bool',   NULL,                                              true),
  (4,  'Estado general de la obra civil (caminos, drenajes, canaletas)',                        'select', ARRAY['Bueno','Regular','Malo'],                    true),

  -- -------------------------------------------------------------------------
  -- SECCION B: Paneles Solares
  -- -------------------------------------------------------------------------
  (5,  'Limpieza de paneles realizada (polvo, hojas, aves)',                                   'bool',   NULL,                                              true),
  (6,  'Inspección visual de paneles: grietas, delaminación, quemaduras',                      'select', ARRAY['Sin novedad','Con observaciones','Crítico'], true),
  (7,  'Estructura de montaje de paneles: tornillería apretada y sin corrosión',               'bool',   NULL,                                              true),
  (8,  'Observaciones paneles solares',                                                        'text',   NULL,                                              false),

  -- -------------------------------------------------------------------------
  -- SECCION C: Inversores
  -- -------------------------------------------------------------------------
  (9,  'Inversores encienden sin alarmas activas',                                             'bool',   NULL,                                              true),
  (10, 'Ventilación del inversor libre de obstrucciones',                                     'bool',   NULL,                                              true),
  (11, 'Temperatura de operación del inversor (°C)',                                          'number', NULL,                                              true),
  (12, 'Registro de alarmas/fallas previas en el display del inversor',                       'select', ARRAY['Sin alarmas','Con alarmas resueltas','Con alarmas activas'], true),
  (13, 'Limpieza interior del gabinete del inversor realizada',                               'bool',   NULL,                                              true),
  (14, 'Observaciones inversores',                                                            'text',   NULL,                                              false),

  -- -------------------------------------------------------------------------
  -- SECCION D: Cableado DC / AC y Combiner Box
  -- -------------------------------------------------------------------------
  (15, 'Inspección visual de cableado DC: sin daños mecánicos ni exposición',                 'bool',   NULL,                                              true),
  (16, 'Combiner Box: estado de fusibles y seccionadores',                                    'select', ARRAY['OK','Fusible fundido','Seccionador dañado'], true),
  (17, 'Prueba de aislamiento DC realizada',                                                  'bool',   NULL,                                              true),
  (18, 'Cableado AC desde inversor a tablero: fijación y estado del aislamiento',             'bool',   NULL,                                              true),
  (19, 'Observaciones cableado',                                                              'text',   NULL,                                              false),

  -- -------------------------------------------------------------------------
  -- SECCION E: Tablero Eléctrico y Protecciones
  -- -------------------------------------------------------------------------
  (20, 'Tablero de baja tensión: limpieza interna realizada',                                 'bool',   NULL,                                              true),
  (21, 'Interruptores termomagnéticos: operación manual verificada',                          'bool',   NULL,                                              true),
  (22, 'Protección diferencial: test de disparo positivo',                                    'bool',   NULL,                                              true),
  (23, 'SPD (protección contra sobretensiones): estado del indicador',                        'select', ARRAY['Activo','Degradado','Fallado'],               true),
  (24, 'Apriete de borneras y bornes principales (termografía si aplica)',                    'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION F: Medición y Puesta a Tierra
  -- -------------------------------------------------------------------------
  (25, 'Medición de resistencia de puesta a tierra (Ω)',                                     'number', NULL,                                              true),
  (26, 'Valor de resistencia de puesta a tierra aceptable (< 10 Ω)',                         'bool',   NULL,                                              true),
  (27, 'Conductores de tierra visibles y sin corrosión',                                     'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION G: Medidor y Conexión a Red
  -- -------------------------------------------------------------------------
  (28, 'Medidor de energía funcionando y sin alarmas',                                       'bool',   NULL,                                              true),
  (29, 'Lectura del medidor: energía inyectada a la red (kWh)',                              'number', NULL,                                              true),
  (30, 'Lectura del medidor: energía consumida del sitio (kWh)',                             'number', NULL,                                              false),
  (31, 'Comunicación con sistema SCADA/monitoreo activa',                                    'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION H: Seguridad y Cierre
  -- -------------------------------------------------------------------------
  (32, 'Equipos de protección personal (EPP) utilizados durante la visita',                  'bool',   NULL,                                              true),
  (33, 'Bloqueo y etiquetado (LOTO) aplicado donde correspondía',                            'bool',   NULL,                                              true),
  (34, 'El sitio queda energizado y operativo al finalizar la visita',                        'bool',   NULL,                                              true),
  (35, 'Fotografías del estado del sitio tomadas',                                           'bool',   NULL,                                              true),
  (36, 'Observaciones generales y acciones de seguimiento requeridas',                       'text',   NULL,                                              false)

) AS item(order_index, label, item_type, options, required);


-- =============================================================================
-- TEMPLATE 2: diesel_prev — Mantenimiento Preventivo Generador Diésel
-- =============================================================================

WITH tmpl AS (
  INSERT INTO checklist_templates (id, org_id, type, name, version, is_active)
  VALUES (
    gen_random_uuid(),
    NULL,                                         -- global template
    'diesel_prev',
    'Mantenimiento Preventivo Generador Diésel - v1',
    1,
    true
  )
  RETURNING id
)
INSERT INTO checklist_items (id, template_id, label, order_index, item_type, options, required)
SELECT
  gen_random_uuid(),
  tmpl.id,
  item.label,
  item.order_index,
  item.item_type,
  item.options,
  item.required
FROM tmpl
CROSS JOIN (VALUES
  -- -------------------------------------------------------------------------
  -- SECCION A: Inspección General del Sitio y Generador
  -- -------------------------------------------------------------------------
  (1,  'Área del generador limpia, despejada y sin acumulación de combustible',                'bool',   NULL,                                              true),
  (2,  'Gabinete o caseta del generador: estado de puertas, sellos y ventilación',            'select', ARRAY['Bueno','Regular','Malo'],                    true),
  (3,  'Señalética de seguridad (alto voltaje, no fumar, riesgo de arranque) visible',        'bool',   NULL,                                              true),
  (4,  'Número de serie del generador',                                                       'text',   NULL,                                              true),
  (5,  'Horómetro actual (horas de operación)',                                               'number', NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION B: Sistema de Combustible
  -- -------------------------------------------------------------------------
  (6,  'Nivel de combustible en el estanque (%)',                                             'number', NULL,                                              true),
  (7,  'Estanque de combustible sin fugas ni corrosión visible',                              'bool',   NULL,                                              true),
  (8,  'Filtro de combustible: estado y fecha del último cambio',                             'select', ARRAY['OK - dentro de periodo','Requiere cambio próximo','Cambiado en esta visita'], true),
  (9,  'Líneas de combustible: sin fugas, fijación correcta',                                 'bool',   NULL,                                              true),
  (10, 'Trampa de agua vaciada',                                                              'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION C: Sistema de Aceite y Lubricación
  -- -------------------------------------------------------------------------
  (11, 'Nivel de aceite del motor: dentro del rango (varilla)',                               'bool',   NULL,                                              true),
  (12, 'Estado del aceite (color, viscosidad, sin contaminación)',                            'select', ARRAY['OK','Oscuro/degradado','Contaminado con agua/combustible'], true),
  (13, 'Cambio de aceite realizado en esta visita',                                           'bool',   NULL,                                              false),
  (14, 'Filtro de aceite: estado',                                                            'select', ARRAY['OK - dentro de periodo','Requiere cambio próximo','Cambiado en esta visita'], true),
  (15, 'Sin fugas de aceite en el bloque, tapa de válvulas o cárter',                        'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION D: Sistema de Refrigeración
  -- -------------------------------------------------------------------------
  (16, 'Nivel de refrigerante en el radiador y depósito de expansión',                       'select', ARRAY['Correcto','Bajo','Vacío'],                   true),
  (17, 'Estado del refrigerante: sin contaminación con aceite',                              'bool',   NULL,                                              true),
  (18, 'Radiador: limpio, sin obstrucciones ni corrosión',                                   'bool',   NULL,                                              true),
  (19, 'Correas del ventilador y alternador de carga: tensión y estado',                     'select', ARRAY['OK','Desgastada','Requiere reemplazo'],       true),
  (20, 'Mangueras del sistema de refrigeración: sin fisuras ni ablandamiento',               'bool',   NULL,                                              true),
  (21, 'Temperatura de operación del motor durante prueba de carga (°C)',                    'number', NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION E: Sistema de Arranque y Baterías
  -- -------------------------------------------------------------------------
  (22, 'Batería de arranque: nivel de electrolito (si aplica)',                              'select', ARRAY['Correcto','Bajo','No aplica (VRLA)'],         true),
  (23, 'Tensión de la batería de arranque en reposo (V DC)',                                 'number', NULL,                                              true),
  (24, 'Bornes de batería: limpios, apretados, sin sulfatación',                             'bool',   NULL,                                              true),
  (25, 'Cargador de batería funcionando correctamente',                                      'bool',   NULL,                                              true),
  (26, 'Prueba de arranque automático (ATS): exitosa',                                       'bool',   NULL,                                              true),
  (27, 'Tiempo de arranque hasta toma de carga (segundos)',                                  'number', NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION F: Sistema de Escape y Admisión de Aire
  -- -------------------------------------------------------------------------
  (28, 'Filtro de aire: estado (limpio / sucio / reemplazado)',                              'select', ARRAY['Limpio','Sucio - limpiado','Reemplazado'],    true),
  (29, 'Sistema de escape: sin fugas de gases en uniones y colectores',                      'bool',   NULL,                                              true),
  (30, 'Silenciador en buen estado, sin perforaciones ni óxido severo',                      'bool',   NULL,                                              true),
  (31, 'Salida de gases al exterior: libre de obstrucciones',                                'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION G: Sistema Eléctrico del Generador
  -- -------------------------------------------------------------------------
  (32, 'Tablero de control del generador: sin alarmas activas',                              'bool',   NULL,                                              true),
  (33, 'Tensión de salida L1-N / L2-N / L3-N en carga (V AC)',                              'text',   NULL,                                              true),
  (34, 'Frecuencia de salida (Hz)',                                                          'number', NULL,                                              true),
  (35, 'Potencia activa entregada durante prueba (kW)',                                      'number', NULL,                                              false),
  (36, 'Cableado de salida del alternador: estado del aislamiento',                          'bool',   NULL,                                              true),
  (37, 'Interruptor principal del generador: operación correcta',                            'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION H: Transferencia Automática (ATS)
  -- -------------------------------------------------------------------------
  (38, 'Panel ATS: sin alarmas ni indicadores de falla',                                     'bool',   NULL,                                              true),
  (39, 'Prueba de transferencia red → generador: tiempo de conmutación (s)',                 'number', NULL,                                              true),
  (40, 'Prueba de retransferencia generador → red: correcta',                               'bool',   NULL,                                              true),
  (41, 'Apriete de borneras en el ATS realizado',                                           'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION I: Medición de Puesta a Tierra
  -- -------------------------------------------------------------------------
  (42, 'Medición de resistencia de puesta a tierra del grupo electrógeno (Ω)',              'number', NULL,                                              true),
  (43, 'Valor de resistencia de puesta a tierra aceptable (< 10 Ω)',                        'bool',   NULL,                                              true),

  -- -------------------------------------------------------------------------
  -- SECCION J: Seguridad y Cierre
  -- -------------------------------------------------------------------------
  (44, 'EPP utilizado durante toda la visita',                                               'bool',   NULL,                                              true),
  (45, 'LOTO aplicado en los puntos de energía durante el mantenimiento',                    'bool',   NULL,                                              true),
  (46, 'Extintor del sitio: vigente y con carga completa',                                   'bool',   NULL,                                              true),
  (47, 'Libro de novedades del sitio actualizado',                                           'bool',   NULL,                                              false),
  (48, 'El generador queda en modo automático al finalizar la visita',                       'bool',   NULL,                                              true),
  (49, 'Fotografías del estado del generador tomadas',                                       'bool',   NULL,                                              true),
  (50, 'Observaciones generales y acciones de seguimiento requeridas',                       'text',   NULL,                                              false)

) AS item(order_index, label, item_type, options, required);


-- =============================================================================
-- VERIFICATION QUERY
-- Run this after seeding to confirm insertion counts.
-- =============================================================================
SELECT
  ct.name                  AS template_name,
  ct.type                  AS maintenance_type,
  ct.is_active,
  COUNT(ci.id)             AS total_items
FROM checklist_templates ct
LEFT JOIN checklist_items ci ON ci.template_id = ct.id
WHERE ct.org_id IS NULL
GROUP BY ct.id, ct.name, ct.type, ct.is_active
ORDER BY ct.type;
