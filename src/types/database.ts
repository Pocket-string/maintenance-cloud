// ============================================================
// Bitalize Cloud Mantenimiento — Database Types
// Auto-generated from PRP data model. Do NOT mix business logic here.
// ============================================================

// ------------------------------------------------------------------
// Scalar Union Types (shared across tables)
// ------------------------------------------------------------------

export type UserRole = 'owner' | 'ops' | 'admin' | 'tech'

export type SiteType = 'fv_pmgd' | 'diesel' | 'hybrid'

export type AssetType =
  | 'inverter'
  | 'panel_string'
  | 'transformer'
  | 'meter'
  | 'diesel_gen'
  | 'ats'
  | 'battery_bank'
  | 'tracker'
  | 'string_box'
  | 'switchgear'
  | 'ncu'
  | 'rack'
  | 'ups'
  | 'sensor'
  | 'ppc'
  | 'center'
  | 'module'
  | 'building'
  | 'other'

export type AssetStatus = 'active' | 'inactive' | 'decommissioned'

export type MaintenanceType = 'pv_prev' | 'diesel_prev' | 'corrective'

export type RecordStatus = 'draft' | 'submitted' | 'reviewed' | 'closed'

export type ChecklistItemType = 'bool' | 'text' | 'number' | 'select'

export type PlanStatus = 'draft' | 'active' | 'paused' | 'archived'

export type FrequencyType = 'fixed' | 'special'

export type ScheduledTaskStatus = 'pending' | 'completed' | 'skipped' | 'overdue'

// ------------------------------------------------------------------
// Embedded / composite value types
// ------------------------------------------------------------------

export interface Coordinates {
  lat: number
  lng: number
}

// ------------------------------------------------------------------
// Table row interfaces (mirror DB columns 1-to-1)
// ------------------------------------------------------------------

// organizations
export interface Organization {
  id: string // uuid
  name: string
  rut: string | null
  created_at: string // ISO 8601
}

// profiles  (keyed by auth.users.id)
export interface Profile {
  user_id: string // uuid — references auth.users
  full_name: string
  email: string
  phone: string | null
  created_at: string
}

// organization_members
export interface OrganizationMember {
  id: string // uuid
  org_id: string // uuid — references organizations
  user_id: string // uuid — references auth.users
  role: UserRole
  invited_by: string | null // uuid — references auth.users
  created_at: string
}

// sites
export interface Site {
  id: string // uuid
  org_id: string // uuid — references organizations
  name: string
  commune: string
  region: string
  coordinates: Coordinates | null
  type: SiteType
  created_at: string
}

// assets
export interface Asset {
  id: string // uuid
  site_id: string // uuid — references sites
  org_id: string // uuid — references organizations
  parent_id: string | null // uuid — references assets (self-referencing hierarchy)
  name: string
  type: AssetType
  code: string | null // unique technical code per org (e.g. CT-TRFC-N°01-ZV)
  tag: string | null // field label / physical tag
  priority: number // 1-5 criticality (1=critical, 5=low)
  brand: string | null
  model: string | null
  serial: string | null
  install_date: string | null // ISO 8601 date string (YYYY-MM-DD)
  status: AssetStatus
  created_at: string
}

// maintenance_records
export interface MaintenanceRecord {
  id: string // uuid
  org_id: string // uuid — references organizations
  site_id: string // uuid — references sites
  type: MaintenanceType
  status: RecordStatus
  responsible_id: string // uuid — references auth.users
  reviewed_by: string | null // uuid — references auth.users
  visit_date: string // ISO 8601 date string (YYYY-MM-DD)
  observations: string | null
  created_at: string
  updated_at: string
}

// checklist_templates
export interface ChecklistTemplate {
  id: string // uuid
  org_id: string | null // uuid — null means global (system-wide) template
  type: MaintenanceType
  name: string
  version: number
  is_active: boolean
  created_at: string
}

// checklist_items
export interface ChecklistItem {
  id: string // uuid
  template_id: string | null // uuid — references checklist_templates (null for task-specific items)
  plan_task_id: string | null // uuid — references plan_tasks (null for template-based items)
  label: string
  order_index: number
  item_type: ChecklistItemType
  options: string[] | null // only meaningful when item_type === 'select'
  required: boolean
}

// checklist_responses
export interface ChecklistResponse {
  id: string // uuid
  record_id: string // uuid — references maintenance_records
  item_id: string // uuid — references checklist_items
  value: string
  note: string | null
  created_at: string
}

// materials_lines
export interface MaterialsLine {
  id: string // uuid
  record_id: string // uuid — references maintenance_records
  description: string
  quantity: number
  unit: string
  unit_cost: number | null
  created_at: string
}

// attachments
export type AttachmentCategory = 'image' | 'document' | 'video'

export interface Attachment {
  id: string // uuid
  record_id: string // uuid — references maintenance_records
  file_path: string
  file_name: string
  file_size: number // bytes
  mime_type: string
  category: AttachmentCategory // generated column from mime_type
  uploaded_by: string // uuid — references auth.users
  created_at: string
}

// audit_log
export interface AuditLog {
  id: string // uuid
  org_id: string // uuid — references organizations
  user_id: string // uuid — references auth.users
  action: string
  entity_type: string
  entity_id: string // uuid
  metadata: Record<string, unknown> | null
  created_at: string
}

// maintenance_plans
export interface MaintenancePlan {
  id: string
  org_id: string
  site_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  status: PlanStatus
  created_by: string
  created_at: string
  updated_at: string
}

// plan_categories
export interface PlanCategory {
  id: string
  plan_id: string
  name: string
  order_index: number
}

// plan_tasks
export interface PlanTask {
  id: string
  category_id: string
  plan_id: string
  indice: string | null
  subindice: string | null
  description: string
  frequency_months: number | null
  frequency_type: FrequencyType
  frequency_detail: string | null
  order_index: number
  is_active: boolean
}

// scheduled_tasks
export interface ScheduledTask {
  id: string
  org_id: string
  plan_task_id: string
  plan_id: string
  scheduled_date: string
  due_date: string
  status: ScheduledTaskStatus
  completed_date: string | null
  completed_by: string | null
  maintenance_record_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------------
// Insert types  (omit server-generated fields)
// ------------------------------------------------------------------

export type OrganizationInsert = Omit<Organization, 'id' | 'created_at'> &
  Partial<Pick<Organization, 'id' | 'created_at'>>

export type ProfileInsert = Omit<Profile, 'created_at'> &
  Partial<Pick<Profile, 'created_at'>>

export type OrganizationMemberInsert = Omit<OrganizationMember, 'id' | 'created_at'> &
  Partial<Pick<OrganizationMember, 'id' | 'created_at'>>

export type SiteInsert = Omit<Site, 'id' | 'created_at'> &
  Partial<Pick<Site, 'id' | 'created_at'>>

export type AssetInsert = Omit<Asset, 'id' | 'created_at'> &
  Partial<Pick<Asset, 'id' | 'created_at'>>

export type MaintenanceRecordInsert = Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>>

export type ChecklistTemplateInsert = Omit<ChecklistTemplate, 'id' | 'created_at'> &
  Partial<Pick<ChecklistTemplate, 'id' | 'created_at'>>

export type ChecklistItemInsert = Omit<ChecklistItem, 'id'> &
  Partial<Pick<ChecklistItem, 'id'>>
// Note: exactly one of template_id or plan_task_id must be non-null (DB constraint chk_items_source)

export type ChecklistResponseInsert = Omit<ChecklistResponse, 'id' | 'created_at'> &
  Partial<Pick<ChecklistResponse, 'id' | 'created_at'>>

export type MaterialsLineInsert = Omit<MaterialsLine, 'id' | 'created_at'> &
  Partial<Pick<MaterialsLine, 'id' | 'created_at'>>

export type AttachmentInsert = Omit<Attachment, 'id' | 'created_at' | 'category'> &
  Partial<Pick<Attachment, 'id' | 'created_at'>>

export type AuditLogInsert = Omit<AuditLog, 'id' | 'created_at'> &
  Partial<Pick<AuditLog, 'id' | 'created_at'>>

export type MaintenancePlanInsert = Omit<MaintenancePlan, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MaintenancePlan, 'id' | 'created_at' | 'updated_at'>>

export type PlanCategoryInsert = Omit<PlanCategory, 'id'> &
  Partial<Pick<PlanCategory, 'id'>>

export type PlanTaskInsert = Omit<PlanTask, 'id'> &
  Partial<Pick<PlanTask, 'id'>>

export type ScheduledTaskInsert = Omit<ScheduledTask, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<ScheduledTask, 'id' | 'created_at' | 'updated_at'>>

// ------------------------------------------------------------------
// Update types  (all mutable fields become optional; PKs excluded)
// ------------------------------------------------------------------

export type OrganizationUpdate = Partial<Omit<Organization, 'id' | 'created_at'>>

export type ProfileUpdate = Partial<Omit<Profile, 'user_id' | 'created_at'>>

export type OrganizationMemberUpdate = Partial<
  Omit<OrganizationMember, 'id' | 'org_id' | 'user_id' | 'created_at'>
>

export type SiteUpdate = Partial<Omit<Site, 'id' | 'org_id' | 'created_at'>>

export type AssetUpdate = Partial<Omit<Asset, 'id' | 'site_id' | 'org_id' | 'created_at'>>

export type MaintenanceRecordUpdate = Partial<
  Omit<MaintenanceRecord, 'id' | 'org_id' | 'site_id' | 'created_at'>
>

export type ChecklistTemplateUpdate = Partial<
  Omit<ChecklistTemplate, 'id' | 'created_at'>
>

export type ChecklistItemUpdate = Partial<Omit<ChecklistItem, 'id' | 'template_id' | 'plan_task_id'>>

export type ChecklistResponseUpdate = Partial<
  Omit<ChecklistResponse, 'id' | 'record_id' | 'item_id' | 'created_at'>
>

export type MaterialsLineUpdate = Partial<Omit<MaterialsLine, 'id' | 'record_id' | 'created_at'>>

export type AttachmentUpdate = never // attachments are immutable once uploaded

export type AuditLogUpdate = never // audit log is append-only

export type MaintenancePlanUpdate = Partial<Omit<MaintenancePlan, 'id' | 'org_id' | 'created_by' | 'created_at'>>

export type PlanCategoryUpdate = Partial<Omit<PlanCategory, 'id' | 'plan_id'>>

export type PlanTaskUpdate = Partial<Omit<PlanTask, 'id' | 'category_id' | 'plan_id'>>

export type ScheduledTaskUpdate = Partial<Omit<ScheduledTask, 'id' | 'org_id' | 'plan_task_id' | 'plan_id' | 'created_at'>>

// ------------------------------------------------------------------
// Supabase Database helper type
// Allows using `createClient<Database>()` for full type safety.
// ------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: OrganizationInsert
        Update: OrganizationUpdate
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      organization_members: {
        Row: OrganizationMember
        Insert: OrganizationMemberInsert
        Update: OrganizationMemberUpdate
      }
      sites: {
        Row: Site
        Insert: SiteInsert
        Update: SiteUpdate
      }
      assets: {
        Row: Asset
        Insert: AssetInsert
        Update: AssetUpdate
      }
      maintenance_records: {
        Row: MaintenanceRecord
        Insert: MaintenanceRecordInsert
        Update: MaintenanceRecordUpdate
      }
      checklist_templates: {
        Row: ChecklistTemplate
        Insert: ChecklistTemplateInsert
        Update: ChecklistTemplateUpdate
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: ChecklistItemInsert
        Update: ChecklistItemUpdate
      }
      checklist_responses: {
        Row: ChecklistResponse
        Insert: ChecklistResponseInsert
        Update: ChecklistResponseUpdate
      }
      materials_lines: {
        Row: MaterialsLine
        Insert: MaterialsLineInsert
        Update: MaterialsLineUpdate
      }
      attachments: {
        Row: Attachment
        Insert: AttachmentInsert
        Update: AttachmentUpdate
      }
      audit_log: {
        Row: AuditLog
        Insert: AuditLogInsert
        Update: AuditLogUpdate
      }
      maintenance_plans: {
        Row: MaintenancePlan
        Insert: MaintenancePlanInsert
        Update: MaintenancePlanUpdate
      }
      plan_categories: {
        Row: PlanCategory
        Insert: PlanCategoryInsert
        Update: PlanCategoryUpdate
      }
      plan_tasks: {
        Row: PlanTask
        Insert: PlanTaskInsert
        Update: PlanTaskUpdate
      }
      scheduled_tasks: {
        Row: ScheduledTask
        Insert: ScheduledTaskInsert
        Update: ScheduledTaskUpdate
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      site_type: SiteType
      asset_type: AssetType
      asset_status: AssetStatus
      maintenance_type: MaintenanceType
      record_status: RecordStatus
      checklist_item_type: ChecklistItemType
      plan_status: PlanStatus
      frequency_type: FrequencyType
      scheduled_task_status: ScheduledTaskStatus
    }
  }
}
