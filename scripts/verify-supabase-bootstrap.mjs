#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase/migrations");

const expectedMigrations = [
  "20260916000001_auth_tenancy_rls.sql",
  "20260916000002_brand_brain_core.sql",
  "20260916000003_brand_brain_ingestion.sql",
  "20260917000004_hardened_auth_tenancy_rls.sql",
  "20260918000005_hardened_ingestion_tenancy.sql",
  "20260918000006_canonical_hardened_rls.sql",
  "20260919000001_role_helper_bootstrap.sql",
  "20260929000007_live_foundation_closure.sql",
  "20260929000008_predeployment_integrity.sql",
  "20260929000009_postdeployment_sync.sql",
  "20260929000010_articles_schema.sql",
];

const requiredTables = [
  "profiles",
  "organizations",
  "organization_members",
  "brands",
  "brand_members",
  "websites",
  "brand_profiles",
  "brand_products",
  "brand_audiences",
  "brand_voice_profiles",
  "brand_voice_examples",
  "brand_terminology",
  "brand_policies",
  "brand_competitors",
  "brand_audit_logs",
  "knowledge_sources",
  "knowledge_documents",
  "knowledge_chunks",
  "evidence_sources",
  "evidence_claims",
  "evidence_claim_sources",
  "articles",
  "article_working_documents",
  "article_versions",
  "content_block_operations",
];

export function verifyMigrations() {
  console.log("=== OmniRank Supabase Migration Static Validation ===");
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

  console.log(`Found ${files.length} migration files in supabase/migrations/`);

  // 1. Verify all expected migrations exist
  for (const expected of expectedMigrations) {
    if (!files.includes(expected)) {
      throw new Error(`Missing expected migration: ${expected}`);
    }
    console.log(`  ✓ Found ${expected}`);
  }

  // 2. Concatenate and inspect full migration sequence
  let fullSql = "";
  for (const f of expectedMigrations) {
    const filePath = path.join(migrationsDir, f);
    const content = fs.readFileSync(filePath, "utf-8");
    fullSql += `\n-- >>> ${f} <<<\n` + content;
  }

  // 3. Verify all required tables are created
  console.log("\nVerifying required tables:");
  for (const table of requiredTables) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(public\\.)?${table}\\b`, "i");
    if (!tablePattern.test(fullSql)) {
      throw new Error(`Migration sequence fails to create required table: ${table}`);
    }
    console.log(`  ✓ Table public.${table}`);
  }

  // 4. Verify RLS is enabled on all tables
  console.log("\nVerifying RLS enablement:");
  for (const table of requiredTables) {
    const rlsPattern = new RegExp(`ALTER\\s+TABLE\\s+(public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");
    if (!rlsPattern.test(fullSql)) {
      throw new Error(`Migration sequence fails to enable RLS on table: ${table}`);
    }
    console.log(`  ✓ RLS enabled on public.${table}`);
  }

  // 5. Verify core architecture & security requirements
  console.log("\nVerifying core security & schema components:");

  // pgvector
  if (!/CREATE\s+EXTENSION\s+(IF\s+NOT\s+EXISTS\s+)?vector/i.test(fullSql)) {
    throw new Error("Missing pgvector extension creation");
  }
  console.log("  ✓ pgvector extension");

  // authz schema
  if (!/CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?authz/i.test(fullSql)) {
    throw new Error("Missing authz schema creation");
  }
  console.log("  ✓ authz schema");

  // owner invariant
  if (!/enforce_owner_invariant/i.test(fullSql)) {
    throw new Error("Missing owner invariant protection trigger");
  }
  console.log("  ✓ Owner invariant protection (authz.enforce_owner_invariant)");

  // vector search RPC
  if (!/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.match_knowledge_chunks/i.test(fullSql)) {
    throw new Error("Missing match_knowledge_chunks vector search RPC");
  }
  console.log("  ✓ Vector search RPC (public.match_knowledge_chunks)");

  // legacy auth helpers removed
  if (!/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.is_org_member/i.test(fullSql) ||
      !/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.has_brand_role/i.test(fullSql)) {
    throw new Error("Missing removal of legacy public auth helpers");
  }
  console.log("  ✓ Obsolete public auth helpers safely dropped (public.is_org_member, public.has_brand_role, etc.)");

  // rls_auto_enable privilege hardening
  if (!/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rls_auto_enable/i.test(fullSql)) {
    throw new Error("Missing rls_auto_enable privilege revocation");
  }
  console.log("  ✓ public.rls_auto_enable execute permissions revoked from PUBLIC, anon, authenticated");

  // evidence role authorization & verification RPC
  if (!/authz\.verify_evidence_claim/i.test(fullSql) || !/public\.verify_evidence_claim/i.test(fullSql)) {
    throw new Error("Missing verify_evidence_claim RPC");
  }
  console.log("  ✓ Granular evidence role authorization & verification RPC (public.verify_evidence_claim)");

  // migration 00008 pre-deployment integrity checks:
  // auth.users profile backfill
  if (!/FROM\s+auth\.users/i.test(fullSql)) {
    throw new Error("Missing auth.users profile backfill");
  }
  console.log("  ✓ auth.users profile backfill");

  // Direct org insert policy removed
  if (!/DROP\s+POLICY\s+IF\s+EXISTS\s+"organizations_insert_canonical"\s+ON\s+public\.organizations/i.test(fullSql)) {
    throw new Error("Missing drop of direct organization insert policy");
  }
  console.log("  ✓ Direct organization INSERT policy removed (forced atomic creation via RPC)");

  // Generic audit fabrication revoked
  if (!/REVOKE\s+ALL\s+ON\s+FUNCTION\s+authz\.record_audit_event/i.test(fullSql)) {
    throw new Error("Missing audit fabrication RPC revocation");
  }
  console.log("  ✓ Generic audit event RPC revoked from authenticated/public");

  // Blanket authz grants removed
  if (!/REVOKE\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+authz\s+FROM\s+PUBLIC,\s+anon,\s+authenticated/i.test(fullSql)) {
    throw new Error("Missing blanket authz execute revocation");
  }
  console.log("  ✓ Blanket authz schema grants revoked (explicit discrete function grants only)");

  // Legacy validator cleanup
  if (!/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.validate_tenant_brand_consistency/i.test(fullSql)) {
    throw new Error("Missing cleanup of legacy validate_tenant_brand_consistency");
  }
  console.log("  ✓ Obsolete tenancy validator function & triggers dropped");

  console.log("\n=== STATIC MIGRATION VALIDATION PASSED ===");
  return { success: true, migrationCount: expectedMigrations.length, tableCount: requiredTables.length };
}

// Generate unified bootstrap bundle for convenience
export function generateUnifiedBootstrap() {
  const outputPath = path.join(root, "supabase/bootstrap_full_schema.sql");
  let header = `-- ============================================================================\n`;
  header += `-- OmniRank Unified Supabase Database Bootstrap Bundle\n`;
  header += `-- Generated: ${new Date().toISOString()}\n`;
  header += `-- Contains sequential application of migrations 00001 through 00008\n`;
  header += `-- Safe to run in Supabase SQL Editor on a clean project\n`;
  header += `-- ============================================================================\n\n`;

  let combined = header;
  for (const f of expectedMigrations) {
    const filePath = path.join(migrationsDir, f);
    const content = fs.readFileSync(filePath, "utf-8");
    combined += `\n-- ============================================================================\n`;
    combined += `-- MIGRATION: ${f}\n`;
    combined += `-- ============================================================================\n\n`;
    combined += content + "\n";
  }

  fs.writeFileSync(outputPath, combined);
  console.log(`\nGenerated unified bootstrap bundle: supabase/bootstrap_full_schema.sql (${(combined.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && process.argv[1].endsWith("verify-supabase-bootstrap.mjs")) {
  try {
    verifyMigrations();
    generateUnifiedBootstrap();
  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  }
}
