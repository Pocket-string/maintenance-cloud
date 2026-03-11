# Bitalize Cloud Mantenimiento — Project Context

> Este documento esta disenado para ser pegado en las instrucciones de un proyecto de ChatGPT.
> Contiene todo el contexto necesario para que el LLM entienda la aplicacion completa.

---

## 1. Que es esta app

**Bitalize Cloud Mantenimiento** es una plataforma SaaS multi-tenant para gestionar el mantenimiento preventivo y correctivo de activos en plantas de energia renovable (fotovoltaicas PMGD) y generadores diesel en Chile.

### Problema que resuelve
Las empresas de O&M (Operacion y Mantenimiento) gestionan sus actividades con planillas Excel, WhatsApp y PDFs sueltos. Esto genera:
- Cero trazabilidad de lo que se hizo, cuando y quien
- Imposibilidad de medir cumplimiento de planes preventivos
- Perdida de evidencia fotografica y checklists
- Sin reportes automatizados para el cliente final

### Usuarios objetivo
- **Empresas de O&M solar/diesel** que mantienen plantas de terceros
- **Duenos de plantas PMGD** que quieren visibilidad del mantenimiento
- Roles: Owner (dueno), Ops (operaciones), Admin, Tech (tecnico en terreno)

### Flujo principal
1. Admin crea sitios (plantas) y carga el arbol de activos
2. Admin crea un plan de mantenimiento con tareas por categoria y frecuencia
3. El sistema genera automaticamente tareas programadas en el calendario
4. Tecnico va a terreno, ejecuta tareas, llena checklists digitales, sube fotos
5. Admin revisa registros, cambia estado (draft → submitted → reviewed → closed)
6. Se generan reportes mensuales de cumplimiento exportables a Excel/PDF

---

## 2. Stack Tecnico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| UI | React + TypeScript | 19.x / 5.x |
| Estilos | Tailwind CSS | 3.4 |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) | Cloud |
| Validacion | Zod | 3.24 |
| Estado | Zustand | 5.x |
| AI (futuro) | Vercel AI SDK + OpenRouter | 6.x |
| Exportacion | xlsx (Excel), vista print para PDF | - |
| Email | Resend | 6.x |
| Testing | Playwright | 1.58 |

### Comandos
```bash
pnpm run dev          # Dev server (Turbopack)
pnpm run build        # Build produccion
pnpm run typecheck    # Verificar tipos
pnpm run lint         # ESLint
```
**SOLO usar pnpm.** npm esta prohibido.

---

## 3. Arquitectura de Rutas (24 paginas)

```
src/app/
├── page.tsx                              # Redirect → /dashboard
├── (auth)/
│   ├── layout.tsx                        # Split-screen branding + form
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   ├── update-password/page.tsx
│   └── check-email/page.tsx
├── (main)/
│   ├── layout.tsx                        # Sidebar + main content
│   ├── dashboard/page.tsx                # KPIs, cumplimiento, registros recientes
│   ├── maintenance/
│   │   ├── page.tsx                      # Lista de registros (filtrable)
│   │   ├── new/page.tsx                  # Formulario nuevo registro
│   │   └── [id]/page.tsx                 # Detalle: info + checklist + materiales + adjuntos
│   ├── sites/
│   │   ├── page.tsx                      # Lista de sitios
│   │   ├── new/page.tsx                  # Formulario nuevo sitio
│   │   └── [id]/
│   │       ├── page.tsx                  # Detalle sitio + arbol de activos
│   │       └── assets/new/page.tsx       # Formulario nuevo activo
│   ├── assets/page.tsx                   # Tabla de todos los activos
│   ├── plans/
│   │   ├── page.tsx                      # Lista de planes
│   │   ├── new/page.tsx                  # Crear plan
│   │   └── [id]/
│   │       ├── page.tsx                  # Detalle plan + categorias + tareas
│   │       └── calendar/page.tsx         # Calendario del plan especifico
│   ├── calendar/page.tsx                 # Calendario global de tareas programadas
│   ├── reports/
│   │   ├── page.tsx                      # Indice de reportes por plan
│   │   └── monthly/
│   │       ├── page.tsx                  # Reporte mensual interactivo
│   │       └── print/page.tsx            # Vista impresion/PDF
│   └── admin/users/page.tsx              # Gestion de usuarios org
└── api/
    ├── auth/callback/route.ts            # OAuth callback
    ├── export/records/route.ts           # CSV export registros
    ├── export/report/route.ts            # Excel export reporte mensual
    └── generate-checklist/route.ts       # AI: generar items de checklist
```

---

## 4. Modelo de Datos (16 tablas PostgreSQL, todas con RLS)

### Enums
```typescript
UserRole        = 'owner' | 'ops' | 'admin' | 'tech'
SiteType        = 'fv_pmgd' | 'diesel' | 'hybrid'
AssetType       = 'inverter' | 'panel_string' | 'transformer' | 'meter' | 'diesel_gen' | 'ats' | 'battery_bank' | 'tracker' | 'string_box' | 'switchgear' | 'ncu' | 'rack' | 'ups' | 'sensor' | 'ppc' | 'center' | 'module' | 'building' | 'other'
AssetStatus     = 'active' | 'inactive' | 'decommissioned'
MaintenanceType = 'pv_prev' | 'diesel_prev' | 'corrective'
RecordStatus    = 'draft' | 'submitted' | 'reviewed' | 'closed'
ChecklistItemType = 'bool' | 'text' | 'number' | 'select'
PlanStatus      = 'draft' | 'active' | 'paused' | 'archived'
FrequencyType   = 'fixed' | 'special'
ScheduledTaskStatus = 'pending' | 'completed' | 'skipped' | 'overdue'
```

### Tablas y relaciones

```
organizations (1)
  ├── profiles (N) — via user_id (auth.users)
  ├── organization_members (N) — org_id + user_id + role
  ├── sites (N) — org_id
  │     └── assets (N) — site_id, parent_id (self-ref hierarchy, 5 levels)
  ├── maintenance_records (N) — org_id + site_id
  │     ├── checklist_responses (N) — record_id + item_id
  │     ├── materials_lines (N) — record_id
  │     └── attachments (N) — record_id (stored in Supabase Storage)
  ├── checklist_templates (N) — org_id (null = global)
  │     └── checklist_items (N) — template_id
  ├── maintenance_plans (N) — org_id + site_id
  │     ├── plan_categories (N) — plan_id
  │     │     └── plan_tasks (N) — category_id + plan_id
  │     │           └── checklist_items (N) — plan_task_id
  │     └── scheduled_tasks (N) — plan_id + plan_task_id
  └── audit_log (N) — org_id + user_id + entity_type + entity_id
```

### Campos clave por tabla

**organizations**: id, name, rut
**profiles**: user_id (PK=auth.users), full_name, email, phone
**organization_members**: org_id, user_id, role (owner|ops|admin|tech)
**sites**: org_id, name, commune, region, coordinates(lat/lng), type
**assets**: site_id, org_id, parent_id(self-ref), name, type, code, tag, priority(1-5), brand, model, serial, install_date, status
**maintenance_records**: org_id, site_id, type, status, responsible_id, reviewed_by, visit_date, observations
**checklist_templates**: org_id, type, name, version, is_active
**checklist_items**: template_id|plan_task_id (one must be non-null), label, order_index, item_type, options[], required
**checklist_responses**: record_id, item_id, value, note
**materials_lines**: record_id, description, quantity, unit, unit_cost
**attachments**: record_id, file_path, file_name, file_size, mime_type, category(image|document|video), uploaded_by
**audit_log**: org_id, user_id, action, entity_type, entity_id, metadata(jsonb)
**maintenance_plans**: org_id, site_id, name, description, start_date, end_date, status, created_by
**plan_categories**: plan_id, name, order_index
**plan_tasks**: category_id, plan_id, indice, subindice, description, frequency_months, frequency_type, frequency_detail, order_index, is_active
**scheduled_tasks**: org_id, plan_task_id, plan_id, scheduled_date, due_date, status, completed_date, completed_by, maintenance_record_id, notes

---

## 5. Multi-tenancy y Seguridad

- **Aislamiento**: Todas las tablas tienen `org_id` con RLS (Row Level Security) habilitado
- **Patron**: El usuario se autentica → se busca su `organization_members` → se filtra todo por `org_id`
- **Roles**: owner (todo), ops (gestion operativa), admin (admin), tech (solo registros y ejecucion)
- **Auth**: Supabase Auth con email/password, magic link para forgot-password
- **Storage**: Bucket `attachments` en Supabase Storage, paths: `{org_id}/{record_id}/{filename}`

---

## 6. Design System — Neumorphism (Soft UI)

- **Background base**: `#e6e7ee` (gris claro, NO blanco)
- **Sombras raised**: dual shadow `dark (#b8b9be) + light (#ffffff)`
- **Sombras inset**: para inputs, estados activos (pressed)
- **Cards**: `bg-neu-bg shadow-neu` (sin bordes visibles)
- **Inputs**: `bg-neu-bg shadow-neu-inset` (hundidos)
- **Buttons**: raised por defecto → inset on hover/active
- **Sidebar**: dark neumorphism `bg-[#1e3a5f]`, shadows `#142942/#284b7c`

Tokens Tailwind:
```
shadow-neu-xs / shadow-neu-sm / shadow-neu / shadow-neu-md / shadow-neu-lg
shadow-neu-inset-sm / shadow-neu-inset / shadow-neu-inset-md
```

---

## 7. Componentes Clave (29 componentes)

### UI Base
- `Card` — variantes: default, elevated, bordered, gold-accent
- `Button` — variantes: primary, secondary, outline, ghost, danger × sizes sm/md/lg
- `Input` — con label, error, helper text
- `Select` — mismo estilo que Input
- `Badge` — status badges con colores semanticos

### Layout
- `Sidebar` — navegacion principal, dark neumorphism, responsive
- `Header` — titulo de seccion (legacy, poco usado)

### Feature Components
- `SitesList` — tabla de sitios con busqueda
- `AssetsList` — tabla de activos con filtros
- `AssetsTree` — arbol jerarquico colapsable de activos
- `AssetForm` — formulario crear/editar activo
- `MaintenanceList` — tabla de registros con filtros por tipo/estado
- `ChecklistSection` — renderiza items de checklist (bool/text/number/select)
- `MaterialsSection` — tabla editable de materiales usados
- `AttachmentsSection` — upload + preview de imagenes/documentos
- `StatusActions` — botones cambio de estado segun rol
- `CalendarView` — calendario mensual con tareas programadas y acciones
- `UserManagement` — tabla de usuarios con invitacion y cambio de rol

---

## 8. Convenciones de Codigo

- **TypeScript estricto**: nunca `any`, usar `unknown`
- **Naming**: camelCase (vars/functions), PascalCase (components), UPPER_SNAKE_CASE (constants), kebab-case (files)
- **Max**: 500 lineas por archivo, 50 por funcion
- **Validacion**: Zod en server actions y API routes
- **Supabase**: siempre `createClient()` server-side, `createBrowserClient()` client-side
- **Patron auth**: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');`
- **Patron org**: `const { data: member } = await supabase.from('organization_members').select('org_id').eq('user_id', user.id).limit(1).maybeSingle(); if (!member) redirect('/dashboard');`

---

## 9. Estado Actual del Proyecto

- **97 archivos TypeScript** / ~14,000 lineas de codigo
- **16 tablas** con RLS habilitado y 472+ registros de tareas programadas
- **24 paginas** funcionales
- **5 migraciones** SQL aplicadas
- **3 API routes** (export CSV, export Excel, generate checklist AI)
- **Design system** neumorphism aplicado a todos los componentes
- **Demo funcional**: Sitio PFV Zaldivia con 58 activos jerarquicos, 1 plan con 116 tareas, calendario con scheduling automatico
- **Sin deploy a produccion** todavia (solo localhost)

### Pendiente / Roadmap
- Deploy Vercel + Supabase prod
- Notificaciones (email/push cuando tarea vence)
- PWA para uso en terreno (offline-first)
- Modulo de inventario de repuestos
- Dashboard analytics avanzado (graficos temporales)
- Integracion con SCADA/monitoreo de plantas
