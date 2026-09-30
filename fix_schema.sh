#!/bin/bash
# Modify 00013 schema to include opportunity_context
sed -i '' 's/article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,/article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,\n  opportunity_context JSONB,/' supabase/migrations/20260929000013_research_engine_schema.sql

# Update handoff RPC to populate opportunity_context
sed -i '' 's/status, created_by/status, created_by, opportunity_context/' supabase/migrations/20260929000013_research_engine_schema.sql

sed -i '' 's/COALESCE(v_opp.rationale, '\''Gather evidence and construct brief'\''),/COALESCE(v_opp.rationale, '\''Gather evidence and construct brief'\''),\n    '\''standard'\'', '\''draft'\'', auth.uid(),\n    jsonb_build_object('\''type'\'', v_opp.type, '\''target_keyword'\'', v_opp.target_keyword, '\''rationale'\'', v_opp.rationale, '\''source_signals'\'', v_opp.source_signals)/' supabase/migrations/20260929000013_research_engine_schema.sql

# Remove the duplicate inserted lines from the previous sed hack to keep syntax correct
# Actually let's just do a direct replacement for the INSERT statement
