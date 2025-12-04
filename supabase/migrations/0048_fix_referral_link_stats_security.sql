-- Migration: Fix security issue with referral_link_stats view
-- Remove SECURITY DEFINER property from view (if present) and recreate without it

-- Drop the view if it exists
DROP VIEW IF EXISTS public.referral_link_stats;

-- Recreate the view without SECURITY DEFINER
CREATE VIEW public.referral_link_stats AS
SELECT 
    rl.id,
    rl.app_id,
    rl.account_name,
    rl.code,
    rl.url,
    rl.normalized_url,
    rl.status,
    rl.url_validation_status,
    rl.current_uses,
    rl.max_uses,
    rl.last_used_at,
    rl.is_active,
    COUNT(DISTINCT rlu.client_id) as unique_clients,
    COUNT(*) FILTER (WHERE rlu.redeemed = true) as redeemed_count,
    COUNT(*) FILTER (WHERE rlu.redeemed = false) as unredeemed_count,
    COUNT(*) FILTER (WHERE rlu.used_at >= NOW() - INTERVAL '7 days') as uses_last_7_days,
    COUNT(*) FILTER (WHERE rlu.used_at >= NOW() - INTERVAL '30 days') as uses_last_30_days,
    a.name as app_name
FROM public.referral_links rl
LEFT JOIN public.referral_link_usages rlu ON rl.id = rlu.referral_link_id
LEFT JOIN public.apps a ON rl.app_id = a.id
GROUP BY rl.id, rl.app_id, rl.account_name, rl.code, rl.url, rl.normalized_url, 
         rl.status, rl.url_validation_status, rl.current_uses, rl.max_uses, 
         rl.last_used_at, rl.is_active, a.name;

COMMENT ON VIEW public.referral_link_stats IS 
'Aggregated statistics view for referral links with usage counts, unique clients, and time-based metrics';

