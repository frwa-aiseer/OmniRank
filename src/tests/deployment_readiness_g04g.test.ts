import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
const MIG_009 = path.join(MIG_DIR, "20260929000009_postdeployment_sync.sql");

function readMig(): string {
  return fs.readFileSync(MIG_009, "utf-8");
}

describe("OR-G04G — Post-Deployment Sync Gate", () => {
  it("migration 00009 file exists", () => {
    expect(fs.existsSync(MIG_009)).toBe(true);
  });

  describe("1. authz.get_org_role(UUID)", () => {
    it("should CREATE OR REPLACE with SECURITY DEFINER and SET search_path", () => {
      const sql = readMig();
      expect(sql).toContain("CREATE OR REPLACE FUNCTION authz.get_org_role(_org_id UUID)");
      expect(sql).toContain("RETURNS TEXT");
      expect(sql).toMatch(/SECURITY DEFINER[\s\S]*?SET search_path\s*=\s*''/);
    });

    it("should use auth.uid() for caller identity", () => {
      const sql = readMig();
      const fnBlock = sql.substring(
        sql.indexOf("CREATE OR REPLACE FUNCTION authz.get_org_role"),
        sql.indexOf("REVOKE ALL ON FUNCTION authz.get_org_role")
      );
      expect(fnBlock).toContain("auth.uid()");
      expect(fnBlock).not.toContain("_user_id");
    });

    it("should revoke PUBLIC/anon and grant authenticated + service_role", () => {
      const sql = readMig();
      expect(sql).toContain("REVOKE ALL ON FUNCTION authz.get_org_role(UUID) FROM PUBLIC, anon");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION authz.get_org_role(UUID) TO authenticated, service_role");
    });
  });

  describe("2. authz.get_brand_role(UUID)", () => {
    it("should CREATE OR REPLACE with SECURITY DEFINER and SET search_path", () => {
      const sql = readMig();
      expect(sql).toContain("CREATE OR REPLACE FUNCTION authz.get_brand_role(_brand_id UUID)");
      expect(sql).toContain("RETURNS TEXT");
    });

    it("should use auth.uid() and not accept a caller-supplied user ID", () => {
      const sql = readMig();
      const fnBlock = sql.substring(
        sql.indexOf("CREATE OR REPLACE FUNCTION authz.get_brand_role"),
        sql.indexOf("REVOKE ALL ON FUNCTION authz.get_brand_role")
      );
      expect(fnBlock).toContain("auth.uid()");
      expect(fnBlock).not.toContain("_user_id");
    });

    it("should inherit strategist for org owner/admin without explicit brand membership", () => {
      const sql = readMig();
      const fnBlock = sql.substring(
        sql.indexOf("CREATE OR REPLACE FUNCTION authz.get_brand_role"),
        sql.indexOf("REVOKE ALL ON FUNCTION authz.get_brand_role")
      );
      expect(fnBlock).toContain("'strategist'");
      expect(fnBlock).toContain("om.role IN ('owner', 'admin')");
    });

    it("should revoke PUBLIC/anon and grant authenticated + service_role", () => {
      const sql = readMig();
      expect(sql).toContain("REVOKE ALL ON FUNCTION authz.get_brand_role(UUID) FROM PUBLIC, anon");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION authz.get_brand_role(UUID) TO authenticated, service_role");
    });
  });

  describe("3. Harden public.handle_new_user()", () => {
    it("should revoke from authenticated (not just PUBLIC/anon)", () => {
      const sql = readMig();
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated");
    });
  });

  describe("4. Harden authz.prevent_audit_tampering()", () => {
    it("should recreate with SECURITY DEFINER and SET search_path = ''", () => {
      const sql = readMig();
      // Find the prevent_audit_tampering definition block
      const fnStart = sql.indexOf("CREATE OR REPLACE FUNCTION authz.prevent_audit_tampering()");
      expect(fnStart).toBeGreaterThan(-1);
      const fnBlock = sql.substring(fnStart, fnStart + 300);
      expect(fnBlock).toContain("SECURITY DEFINER");
      expect(fnBlock).toMatch(/SET search_path\s*=\s*''/);
    });

    it("should still raise exception on tampering", () => {
      const sql = readMig();
      const fnStart = sql.indexOf("CREATE OR REPLACE FUNCTION authz.prevent_audit_tampering()");
      const fnBlock = sql.substring(fnStart, fnStart + 400);
      expect(fnBlock).toContain("RAISE EXCEPTION");
      expect(fnBlock).toContain("append-only");
    });
  });

  describe("5. FK Indexes", () => {
    const expectedIndexes = [
      { name: "idx_knowledge_sources_org", table: "knowledge_sources", column: "organization_id" },
      { name: "idx_knowledge_documents_source", table: "knowledge_documents", column: "source_id" },
      { name: "idx_knowledge_chunks_source", table: "knowledge_chunks", column: "source_id" },
      { name: "idx_evidence_claim_sources_source", table: "evidence_claim_sources", column: "source_id" },
      { name: "idx_evidence_claim_sources_doc", table: "evidence_claim_sources", column: "document_id" },
      { name: "idx_evidence_claim_sources_chunk", table: "evidence_claim_sources", column: "chunk_id" },
    ];

    for (const idx of expectedIndexes) {
      it(`should create index ${idx.name} on ${idx.table}(${idx.column})`, () => {
        const sql = readMig();
        expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${idx.name} ON public.${idx.table}(${idx.column})`);
      });
    }
  });

  describe("6. Migration chain integrity", () => {
    it("should have 10 sequential migration files", () => {
      const files = fs.readdirSync(MIG_DIR).filter((f: string) => f.endsWith(".sql")).sort();
      expect(files.length).toBe(10);
      expect(files[6]).toBe("20260919000001_role_helper_bootstrap.sql");
      expect(files[9]).toBe("20260929000009_postdeployment_sync.sql");
    });

    it("should explicitly verify sorted migration order places role-helper creation before 00008's GRANT statements", () => {
      const files = fs.readdirSync(MIG_DIR).filter((f: string) => f.endsWith(".sql")).sort();
      const bootstrapIdx = files.indexOf("20260919000001_role_helper_bootstrap.sql");
      const mig8Idx = files.indexOf("20260929000008_predeployment_integrity.sql");
      expect(bootstrapIdx).toBeGreaterThan(-1);
      expect(mig8Idx).toBeGreaterThan(-1);
      expect(bootstrapIdx).toBeLessThan(mig8Idx);

      // Verify in concatenated sorted migration stream, creation appears before 00008 grants
      let cumulativeSql = "";
      for (const file of files) {
        cumulativeSql += `\n-- >>> ${file} <<<\n` + fs.readFileSync(path.join(MIG_DIR, file), "utf-8");
      }

      const createOrgRolePos = cumulativeSql.indexOf("CREATE OR REPLACE FUNCTION authz.get_org_role");
      const createBrandRolePos = cumulativeSql.indexOf("CREATE OR REPLACE FUNCTION authz.get_brand_role");
      const grantOrgRolePos = cumulativeSql.indexOf("GRANT EXECUTE ON FUNCTION authz.get_org_role(UUID) TO authenticated");
      const grantBrandRolePos = cumulativeSql.indexOf("GRANT EXECUTE ON FUNCTION authz.get_brand_role(UUID) TO authenticated");

      expect(createOrgRolePos).toBeGreaterThan(-1);
      expect(createBrandRolePos).toBeGreaterThan(-1);
      expect(grantOrgRolePos).toBeGreaterThan(-1);
      expect(grantBrandRolePos).toBeGreaterThan(-1);

      expect(createOrgRolePos).toBeLessThan(grantOrgRolePos);
      expect(createBrandRolePos).toBeLessThan(grantBrandRolePos);
    });

    it("should not modify existing migration 00008 content", () => {
      const mig8 = fs.readFileSync(path.join(MIG_DIR, "20260929000008_predeployment_integrity.sql"), "utf-8");
      // Verify key 00008 markers are still present
      expect(mig8).toContain("GRANT EXECUTE ON FUNCTION authz.get_org_role(UUID) TO authenticated");
      expect(mig8).toContain("GRANT EXECUTE ON FUNCTION authz.get_brand_role(UUID) TO authenticated");
    });
  });

  describe("7. Bootstrap compatibility migration (20260919000001_role_helper_bootstrap.sql)", () => {
    const MIG_BOOTSTRAP = path.join(MIG_DIR, "20260919000001_role_helper_bootstrap.sql");
    it("should exist and sort between 00006 and 00007", () => {
      expect(fs.existsSync(MIG_BOOTSTRAP)).toBe(true);
      expect("20260918000006_canonical_hardened_rls.sql" < "20260919000001_role_helper_bootstrap.sql").toBe(true);
      expect("20260919000001_role_helper_bootstrap.sql" < "20260929000007_live_foundation_closure.sql").toBe(true);
    });

    it("should define authz.get_org_role and authz.get_brand_role with security definer and pinned search path", () => {
      const sql = fs.readFileSync(MIG_BOOTSTRAP, "utf-8");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION authz.get_org_role(_org_id UUID)");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION authz.get_brand_role(_brand_id UUID)");
      expect(sql).toContain("auth.uid()");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toMatch(/SET search_path\s*=\s*''/);
      expect(sql).toContain("REVOKE ALL ON FUNCTION authz.get_org_role(UUID) FROM PUBLIC, anon");
      expect(sql).toContain("REVOKE ALL ON FUNCTION authz.get_brand_role(UUID) FROM PUBLIC, anon");
    });
  });
});
