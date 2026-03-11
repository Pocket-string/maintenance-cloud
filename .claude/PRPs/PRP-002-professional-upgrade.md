# PRP-002: SMU Cloud - Upgrade Profesional

> **De app simple a CMMS solar competitivo**

## Contexto

Investigacion de mercado revela que **ningun CMMS** combina:
- Espanol-first + compliance PMGD chileno
- PV solar + diesel en una plataforma
- Generacion automatica de informes para inversionistas
- Precio accesible para O&M de 30 sitios

**Oportunidad**: Ser el primer CMMS solar profesional en espanol para LatAm.

---

## Estado Actual vs Profesional

| Feature | Hoy | Objetivo |
|---------|-----|----------|
| Planes de mantenimiento | No existe | Planes anuales con tareas recurrentes |
| Checklists | Template global unico | Templates por tipo de trabajo (PV preventivo, diesel, correctivo) |
| Evidencia fotografica | Upload basico | Fotos geotagged + asociadas a items del checklist |
| Informes | Export CSV | PDFs profesionales auto-generados |
| Programacion | Manual | Calendario con tareas recurrentes |
| KPIs | Conteo basico | Disponibilidad, MTBF, MTTR, cumplimiento de plan |
| Inventario | No existe | Control de repuestos y materiales |
| Mobile | Responsive web | PWA con modo offline |

---

## Roadmap por Sprints

### Sprint 1: Planes de Mantenimiento (Core del negocio)
> Sin esto no hay producto profesional

**Modelo de datos:**
- `maintenance_plans` - Plan anual/semestral por sitio
- `plan_tasks` - Tareas del plan con frecuencia (semanal, quincenal, mensual, trimestral, semestral, anual)
- `plan_task_templates` - Checklist template asociado a cada tarea del plan

**Funcionalidad:**
- CRUD de planes de mantenimiento por sitio
- Definir tareas con frecuencia de repeticion
- Generar automaticamente registros de mantenimiento segun la programacion
- Vista calendario con tareas programadas vs ejecutadas
- % de cumplimiento del plan (tareas ejecutadas / programadas)

**UI:**
- `/plans` - Lista de planes activos
- `/plans/new` - Crear plan con builder de tareas
- `/plans/[id]` - Detalle con calendario y cumplimiento
- `/calendar` - Vista calendario global de todas las tareas

---

### Sprint 2: Checklists Profesionales por Tipo de Trabajo
> Distintos trabajos requieren distintas inspecciones

**Mejoras:**
- Templates de checklist asociados a tipo de trabajo (no globales)
- Categorias dentro del checklist (Seguridad, Electrico, Mecanico, Limpieza)
- Items con tipo expandido: bool, text, number, select, **photo_required**, **measurement_range**
- Validacion de rangos (ej: "Voltaje DC string" debe estar entre 600-1000V)
- Items condicionales (si X falla, mostrar sub-checklist de diagnostico)
- Firma digital del tecnico al completar

**Templates pre-cargados:**
1. Preventivo FV - Inspeccion de paneles
2. Preventivo FV - Inspeccion de inversores
3. Preventivo FV - Inspeccion electrica BT/MT
4. Preventivo FV - Limpieza de paneles
5. Preventivo Diesel - Inspeccion de grupo electrogeno
6. Preventivo Diesel - Cambio de aceite/filtros
7. Correctivo - Diagnostico de falla
8. Correctivo - Reemplazo de componente

---

### Sprint 3: Evidencia Fotografica Profesional
> Las fotos son la PRUEBA de que el trabajo se hizo

**Mejoras:**
- Fotos asociadas a items especificos del checklist (no solo al registro)
- Captura de foto "antes/despues" por item
- Metadata automatica: fecha, hora, GPS (si disponible)
- Galeria del registro con thumbnails
- Compresion automatica para optimizar storage
- Anotaciones sobre la foto (flechas, circulos, texto)

---

### Sprint 4: Generacion de Informes Automaticos (Killer Feature)
> ESTO es lo que ninguna herramienta ofrece para PMGD

**Tipos de informe:**
1. **Informe de Visita** - Por registro individual
   - Datos del sitio, fecha, tecnico
   - Checklist completado con resultados
   - Fotos de evidencia
   - Observaciones y hallazgos
   - Materiales utilizados

2. **Informe Mensual de O&M** - Por sitio, por mes
   - Resumen de visitas realizadas vs programadas
   - % cumplimiento del plan
   - Hallazgos criticos y acciones tomadas
   - Registro fotografico
   - KPIs del periodo

3. **Informe de Cumplimiento** - Por plan completo
   - Avance del plan anual
   - Tareas completadas vs pendientes
   - Tendencias y estadisticas
   - Para presentar a inversionistas/duenos

**Motor de generacion:**
- Templates en React-PDF o similar
- Branding configurable (logo del cliente/O&M)
- Generacion en background
- Descarga PDF + envio por email

---

### Sprint 5: KPIs y Dashboard Profesional
> Metricas que importan al negocio

**KPIs:**
- % Cumplimiento del plan de mantenimiento (por sitio, global)
- Disponibilidad tecnica de planta
- MTBF (Mean Time Between Failures)
- MTTR (Mean Time To Repair)
- Backlog de correctivos abiertos
- Costo de mantenimiento por sitio/MW
- Tendencia de hallazgos por categoria

**Dashboard:**
- Graficos de cumplimiento mensual
- Mapa de sitios con estado (verde/amarillo/rojo)
- Alertas de tareas vencidas
- Timeline de actividad reciente

---

### Sprint 6: Control de Inventario/Repuestos
> Saber que materiales se usan y donde

**Modelo:**
- `inventory_items` - Catalogo de repuestos
- `inventory_stock` - Stock por bodega/ubicacion
- `inventory_movements` - Entradas/salidas vinculadas a registros

**Funcionalidad:**
- Catalogo de repuestos con SKU, descripcion, unidad
- Stock actual por ubicacion
- Al agregar material a un registro, descuenta del stock
- Alertas de stock minimo
- Historial de consumo por sitio

---

### Sprint 7: PWA + Modo Offline (Mobile Pro)
> Los tecnicos estan en terreno sin internet

**Mejoras:**
- Service Worker para cache de datos
- Completar checklists sin conexion
- Tomar fotos offline y sincronizar despues
- Queue de acciones pendientes con sync automatico
- Install prompt como app nativa

---

## Prioridad Recomendada

```
Sprint 1 (Planes)  ←── Sin esto no hay producto
Sprint 2 (Checklists Pro)  ←── Calidad de captura de datos
Sprint 4 (Informes)  ←── Killer feature, diferenciador #1
Sprint 3 (Fotos Pro)  ←── Alimenta los informes
Sprint 5 (KPIs)  ←── Valor para decision-makers
Sprint 6 (Inventario)  ←── Nice to have profesional
Sprint 7 (PWA Offline)  ←── Mejora UX en terreno
```

Los Sprints 1 + 2 + 4 juntos crean el **pipeline Plan → Ejecucion → Informe** que NINGUN competidor ofrece para PMGD en espanol.

---

## Pricing Sugerido

| Tier | Precio | Incluye |
|------|--------|---------|
| **Starter** | $15/user/mo | Registros, checklists, fotos, 5 sitios |
| **Professional** | $30/user/mo | + Planes, informes auto, KPIs, 30 sitios |
| **Enterprise** | $45/user/mo | + API, SSO, offline, sitios ilimitados |

Posicion: Mas barato que CMMS generales premium ($60-75) con 10x mas valor para solar.
