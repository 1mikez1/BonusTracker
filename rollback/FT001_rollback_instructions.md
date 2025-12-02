# FT001 Rollback Instructions

## Overview
This document provides instructions to rollback the FT001 (Partner Filter) feature if critical issues are found.

## Rollback Steps

### 1. Revert Database Migration
```sql
-- Drop the function
DROP FUNCTION IF EXISTS public.get_clients_by_partner;

-- Drop indexes (optional - they don't break existing functionality)
DROP INDEX IF EXISTS idx_client_partners_name_lower;
DROP INDEX IF EXISTS idx_client_partner_assignments_partner_client;
DROP INDEX IF EXISTS idx_clients_created_at;
```

### 2. Revert Code Changes
```bash
# Revert API routes
git checkout HEAD~1 app/api/partners/

# Revert UI changes
git checkout HEAD~1 app/(dashboard)/clients/page.tsx

# Revert types (if needed)
git checkout HEAD~1 types/database.ts
```

### 3. Remove Migration File
```bash
rm supabase/migrations/0042_add_partner_filter_indexes.sql
```

## Impact Assessment

### What Will Break
- Partner filter input in `/clients` page will show errors
- API endpoints `/api/partners/[id]/clients` and `/api/partners/search` will be unavailable

### What Will Continue Working
- All existing client filtering (tier, trusted, status, search)
- Partner detail pages
- All other application functionality

## Rollback Time Estimate
- **Database rollback**: 1-2 minutes
- **Code rollback**: 2-5 minutes
- **Total**: ~5-10 minutes

## Post-Rollback Verification
1. Verify `/clients` page loads without errors
2. Verify existing filters still work
3. Verify no console errors in browser
4. Verify API endpoints return 404 (expected after rollback)

