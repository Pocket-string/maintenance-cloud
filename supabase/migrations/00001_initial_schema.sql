-- =============================================================================
-- SMU Maintenance Cloud - Initial Schema
-- Migration: 00001_initial_schema
-- =============================================================================
-- Multi-tenant architecture. Access is gated via organization_members.
-- All tables with org_id use a helper function to resolve user's org memberships.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 1: HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Returns all org_ids that a given user belongs to.
-- Used in RLS policies to avoid repeating the subquery everywhere.
CREATE OR REPLACE FUNCTION get_user_org_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM organization_members
  WHERE user_id = uid;
$$;

-- Sets updated_at to now(). Used by the trigger on maintenance_records.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-creates a profile row when a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 2: TABLES
-- -----------------------------------------------------------------------------

-- 1. organizations
CREATE TABLE organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  rut        text        UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. profiles
CREATE TABLE profiles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text        NOT NULL,
  email      text        NOT NULL,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. organization_members
CREATE TABLE organization_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('owner', 'ops', 'admin', 'tech')),
  invited_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- 4. sites
CREATE TABLE sites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  commune     text,
  region      text,
  coordinates jsonb,
  type        text        NOT NULL CHECK (type IN ('fv_pmgd', 'diesel', 'hybrid')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. assets
CREATE TABLE assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  type         text        NOT NULL CHECK (type IN (
                             'inverter', 'panel_string', 'transformer',
                             'meter', 'diesel_gen', 'ats', 'battery_bank', 'other'
                           )),
  brand        text,
  model        text,
  serial       text,
  install_date date,
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'inactive', 'decommissioned')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6. maintenance_records
CREATE TABLE maintenance_records (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id        uuid        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type           text        NOT NULL CHECK (type IN ('pv_prev', 'diesel_prev', 'corrective')),
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'submitted', 'reviewed', 'closed')),
  responsible_id uuid        NOT NULL REFERENCES auth.users(id),
  reviewed_by    uuid        REFERENCES auth.users(id),
  visit_date     date        NOT NULL,
  observations   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 7. checklist_templates
CREATE TABLE checklist_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global template
  type       text        NOT NULL CHECK (type IN ('pv_prev', 'diesel_prev', 'corrective')),
  name       text        NOT NULL,
  version    integer     NOT NULL DEFAULT 1,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. checklist_items
CREATE TABLE checklist_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid    NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label       text    NOT NULL,
  order_index integer NOT NULL,
  item_type   text    NOT NULL CHECK (item_type IN ('bool', 'text', 'number', 'select')),
  options     text[],
  required    boolean NOT NULL DEFAULT true
);

-- 9. checklist_responses
CREATE TABLE checklist_responses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id  uuid        NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  item_id    uuid        NOT NULL REFERENCES checklist_items(id),
  value      text        NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. materials_lines
CREATE TABLE materials_lines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid        NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  description text        NOT NULL,
  quantity    numeric     NOT NULL DEFAULT 1,
  unit        text        NOT NULL DEFAULT 'un',
  unit_cost   numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 11. attachments
CREATE TABLE attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid        NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  file_size   integer     NOT NULL,
  mime_type   text        NOT NULL,
  uploaded_by uuid        NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 12. audit_log
CREATE TABLE audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- SECTION 3: INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX idx_org_members_user_id       ON organization_members (user_id);
CREATE INDEX idx_org_members_org_id        ON organization_members (org_id);

CREATE INDEX idx_sites_org_id              ON sites (org_id);

CREATE INDEX idx_assets_site_id            ON assets (site_id);
CREATE INDEX idx_assets_org_id             ON assets (org_id);

CREATE INDEX idx_maintenance_org_id        ON maintenance_records (org_id);
CREATE INDEX idx_maintenance_site_id       ON maintenance_records (site_id);
CREATE INDEX idx_maintenance_responsible   ON maintenance_records (responsible_id);
CREATE INDEX idx_maintenance_status        ON maintenance_records (status);

CREATE INDEX idx_checklist_responses_record ON checklist_responses (record_id);

CREATE INDEX idx_materials_lines_record     ON materials_lines (record_id);

CREATE INDEX idx_attachments_record         ON attachments (record_id);

CREATE INDEX idx_audit_log_org_created      ON audit_log (org_id, created_at DESC);


-- -----------------------------------------------------------------------------
-- SECTION 4: TRIGGERS
-- -----------------------------------------------------------------------------

-- updated_at trigger for maintenance_records
CREATE TRIGGER trg_maintenance_records_updated_at
  BEFORE UPDATE ON maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on new Supabase Auth user
CREATE TRIGGER trg_auth_users_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- -----------------------------------------------------------------------------
-- SECTION 5: ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- RLS: organizations
-- Users can only see organizations they are members of.
-- Only owner/admin can update or delete.
-- New organizations can be created by any authenticated user (they become the owner separately).
-- -----------------------------------------------------------------------------

CREATE POLICY organizations_select ON organizations
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY organizations_insert ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Any authenticated user can create an org; membership is handled separately.

CREATE POLICY organizations_update ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = organizations.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY organizations_delete ON organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: profiles
-- Any authenticated user can read profiles (needed for display names across org).
-- Users can only insert/update their own profile.
-- -----------------------------------------------------------------------------

CREATE POLICY profiles_select ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_insert ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- RLS: organization_members
-- Members can view membership list of orgs they belong to.
-- Only owner/admin can add members.
-- Only owner can update roles.
-- Only owner can remove members; cannot remove self.
-- -----------------------------------------------------------------------------

CREATE POLICY org_members_select ON organization_members
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY org_members_insert ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_members_update ON organization_members
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY org_members_delete ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND user_id <> auth.uid()  -- Cannot delete self
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: sites
-- Standard org_id multi-tenant pattern.
-- DELETE restricted to owner/admin.
-- -----------------------------------------------------------------------------

CREATE POLICY sites_select ON sites
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY sites_insert ON sites
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY sites_update ON sites
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())))
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY sites_delete ON sites
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = sites.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: assets
-- Standard org_id multi-tenant pattern.
-- DELETE restricted to owner/admin.
-- -----------------------------------------------------------------------------

CREATE POLICY assets_select ON assets
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY assets_insert ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY assets_update ON assets
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())))
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY assets_delete ON assets
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = assets.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: maintenance_records
-- Standard org_id multi-tenant pattern.
-- DELETE restricted to owner/admin.
-- -----------------------------------------------------------------------------

CREATE POLICY maintenance_select ON maintenance_records
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY maintenance_insert ON maintenance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY maintenance_update ON maintenance_records
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())))
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY maintenance_delete ON maintenance_records
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = maintenance_records.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: checklist_templates
-- Global templates (org_id IS NULL) are visible to all authenticated users.
-- Org templates visible to org members.
-- Mutations restricted to owner/admin.
-- -----------------------------------------------------------------------------

CREATE POLICY checklist_templates_select ON checklist_templates
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT get_user_org_ids(auth.uid()))
  );

CREATE POLICY checklist_templates_insert ON checklist_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = checklist_templates.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY checklist_templates_update ON checklist_templates
  FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = checklist_templates.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY checklist_templates_delete ON checklist_templates
  FOR DELETE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = checklist_templates.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: checklist_items
-- Access is derived from the parent template's org visibility.
-- Mutations follow the same owner/admin restriction as templates.
-- -----------------------------------------------------------------------------

CREATE POLICY checklist_items_select ON checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      WHERE ct.id = checklist_items.template_id
        AND (
          ct.org_id IS NULL
          OR ct.org_id IN (SELECT get_user_org_ids(auth.uid()))
        )
    )
  );

CREATE POLICY checklist_items_insert ON checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      JOIN organization_members om ON om.org_id = ct.org_id
      WHERE ct.id = checklist_items.template_id
        AND ct.org_id IS NOT NULL
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY checklist_items_update ON checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      JOIN organization_members om ON om.org_id = ct.org_id
      WHERE ct.id = checklist_items.template_id
        AND ct.org_id IS NOT NULL
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY checklist_items_delete ON checklist_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_templates ct
      JOIN organization_members om ON om.org_id = ct.org_id
      WHERE ct.id = checklist_items.template_id
        AND ct.org_id IS NOT NULL
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: checklist_responses
-- Access is derived from the parent maintenance_record's org_id.
-- -----------------------------------------------------------------------------

CREATE POLICY checklist_responses_select ON checklist_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = checklist_responses.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY checklist_responses_insert ON checklist_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = checklist_responses.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY checklist_responses_update ON checklist_responses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = checklist_responses.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY checklist_responses_delete ON checklist_responses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = checklist_responses.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: materials_lines
-- Access derived from parent maintenance_record's org_id.
-- -----------------------------------------------------------------------------

CREATE POLICY materials_lines_select ON materials_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = materials_lines.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY materials_lines_insert ON materials_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = materials_lines.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY materials_lines_update ON materials_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = materials_lines.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY materials_lines_delete ON materials_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = materials_lines.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: attachments
-- Access derived from parent maintenance_record's org_id.
-- Only the uploader or owner/admin can delete.
-- -----------------------------------------------------------------------------

CREATE POLICY attachments_select ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = attachments.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY attachments_insert ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = attachments.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );

CREATE POLICY attachments_delete ON attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records mr
      WHERE mr.id = attachments.record_id
        AND mr.org_id IN (SELECT get_user_org_ids(auth.uid()))
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om
        JOIN maintenance_records mr ON mr.org_id = om.org_id
        WHERE mr.id = attachments.record_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
  );


-- -----------------------------------------------------------------------------
-- RLS: audit_log
-- Members can read their org's audit log.
-- Inserts are allowed for any org member (writes happen from server actions).
-- No updates or deletes (immutable log).
-- -----------------------------------------------------------------------------

CREATE POLICY audit_log_select ON audit_log
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids(auth.uid()))
    AND user_id = auth.uid()
  );

-- No UPDATE or DELETE policies for audit_log — immutable by design.
