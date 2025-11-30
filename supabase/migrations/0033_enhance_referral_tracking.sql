-- Migration: Enhance referral links tracking system
-- Adds account grouping, usage tracking, URL normalization, and detailed statistics

-- Step 1: Add new columns to referral_links table
DO $$
BEGIN
    -- Add account_name for grouping referrals by account
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'account_name'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN account_name text;
        
        COMMENT ON COLUMN public.referral_links.account_name IS 
        'Account name for grouping referrals (e.g., "Luna", "Main Account")';
    END IF;

    -- Add code for referral code tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'code'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN code text;
        
        COMMENT ON COLUMN public.referral_links.code IS 
        'Referral code extracted from URL or manually entered';
    END IF;

    -- Add status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_link_status') THEN
        CREATE TYPE public.referral_link_status AS ENUM (
            'active',
            'inactive',
            'redeemed',
            'expired'
        );
    END IF;

    -- Add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN status public.referral_link_status NOT NULL DEFAULT 'active';
        
        COMMENT ON COLUMN public.referral_links.status IS 
        'Status: active (available), inactive (disabled), redeemed (fully used), expired';
    END IF;

    -- Add normalized_url for validated URLs
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'normalized_url'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN normalized_url text;
        
        COMMENT ON COLUMN public.referral_links.normalized_url IS 
        'Normalized and validated URL version';
    END IF;

    -- Add url_validation_status
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'url_validation_status') THEN
        CREATE TYPE public.url_validation_status AS ENUM (
            'valid',
            'invalid',
            'needs_review',
            'pending'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'url_validation_status'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN url_validation_status public.url_validation_status NOT NULL DEFAULT 'pending';
        
        COMMENT ON COLUMN public.referral_links.url_validation_status IS 
        'URL validation status: valid, invalid, needs_review, pending';
    END IF;

    -- Add last_used_at for quick reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'last_used_at'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN last_used_at timestamptz;
        
        COMMENT ON COLUMN public.referral_links.last_used_at IS 
        'Timestamp of the most recent usage';
    END IF;
END $$;

-- Step 2: Create referral_link_usages table for detailed usage tracking
CREATE TABLE IF NOT EXISTS public.referral_link_usages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    client_app_id uuid REFERENCES public.client_apps(id) ON DELETE SET NULL,
    used_at timestamptz NOT NULL DEFAULT now(),
    used_by text, -- Operator name (e.g., "Luna")
    redeemed boolean NOT NULL DEFAULT false,
    redeemed_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.referral_link_usages IS 
'Detailed tracking of each referral link usage with client, date, redemption status';

COMMENT ON COLUMN public.referral_link_usages.used_by IS 
'Name of the operator who recorded the usage (e.g., "Luna")';

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_link_usages_referral_link 
ON public.referral_link_usages(referral_link_id);

CREATE INDEX IF NOT EXISTS idx_referral_link_usages_client 
ON public.referral_link_usages(client_id);

CREATE INDEX IF NOT EXISTS idx_referral_link_usages_used_at 
ON public.referral_link_usages(used_at);

CREATE INDEX IF NOT EXISTS idx_referral_link_usages_redeemed 
ON public.referral_link_usages(redeemed) 
WHERE redeemed = false;

CREATE INDEX IF NOT EXISTS idx_referral_links_account_name 
ON public.referral_links(account_name) 
WHERE account_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_links_code 
ON public.referral_links(code) 
WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_links_status 
ON public.referral_links(status);

-- Step 4: Create function to normalize and validate URLs
CREATE OR REPLACE FUNCTION public.normalize_referral_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized text;
BEGIN
    -- Trim whitespace
    normalized := trim(p_url);
    
    -- Remove leading/trailing spaces
    normalized := regexp_replace(normalized, '^\s+|\s+$', '', 'g');
    
    -- Convert http to https
    normalized := regexp_replace(normalized, '^http://', 'https://', 'i');
    
    -- Remove duplicate query parameters (keep first occurrence)
    -- This is a simplified version - full deduplication would require parsing
    
    -- Basic URL validation
    IF normalized !~* '^https?://[^\s/$.?#].[^\s]*$' THEN
        RETURN NULL; -- Invalid URL format
    END IF;
    
    RETURN normalized;
END;
$$;

COMMENT ON FUNCTION public.normalize_referral_url(text) IS 
'Normalizes referral URLs: trims spaces, converts http to https, validates format';

-- Step 5: Create function to extract referral code from URL
CREATE OR REPLACE FUNCTION public.extract_referral_code(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    code text;
BEGIN
    -- Try to extract code from common referral URL patterns
    -- Pattern 1: ?ref=CODE or &ref=CODE
    code := (regexp_match(p_url, '[?&]ref=([^&]+)', 'i'))[1];
    IF code IS NOT NULL THEN
        RETURN code;
    END IF;
    
    -- Pattern 2: ?code=CODE or &code=CODE
    code := (regexp_match(p_url, '[?&]code=([^&]+)', 'i'))[1];
    IF code IS NOT NULL THEN
        RETURN code;
    END IF;
    
    -- Pattern 3: ?referral=CODE or &referral=CODE
    code := (regexp_match(p_url, '[?&]referral=([^&]+)', 'i'))[1];
    IF code IS NOT NULL THEN
        RETURN code;
    END IF;
    
    -- Pattern 4: /ref/CODE or /referral/CODE
    code := (regexp_match(p_url, '/(?:ref|referral)/([^/?&]+)', 'i'))[1];
    IF code IS NOT NULL THEN
        RETURN code;
    END IF;
    
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.extract_referral_code(text) IS 
'Extracts referral code from URL using common patterns (ref=, code=, referral=, /ref/, /referral/)';

-- Step 6: Create function to update referral link statistics
CREATE OR REPLACE FUNCTION public.update_referral_link_stats(p_referral_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_usage_count integer;
    v_unique_clients integer;
    v_last_used timestamptz;
    v_redeemed_count integer;
BEGIN
    -- Count total usages
    SELECT COUNT(*)
    INTO v_usage_count
    FROM public.referral_link_usages
    WHERE referral_link_id = p_referral_link_id;
    
    -- Count unique clients
    SELECT COUNT(DISTINCT client_id)
    INTO v_unique_clients
    FROM public.referral_link_usages
    WHERE referral_link_id = p_referral_link_id
    AND client_id IS NOT NULL;
    
    -- Get last used timestamp
    SELECT MAX(used_at)
    INTO v_last_used
    FROM public.referral_link_usages
    WHERE referral_link_id = p_referral_link_id;
    
    -- Count redeemed
    SELECT COUNT(*)
    INTO v_redeemed_count
    FROM public.referral_link_usages
    WHERE referral_link_id = p_referral_link_id
    AND redeemed = true;
    
    -- Update referral_links table
    UPDATE public.referral_links
    SET 
        current_uses = v_usage_count,
        last_used_at = v_last_used,
        status = CASE
            WHEN max_uses IS NOT NULL AND v_usage_count >= max_uses THEN 'redeemed'::public.referral_link_status
            WHEN is_active = false THEN 'inactive'::public.referral_link_status
            ELSE 'active'::public.referral_link_status
        END
    WHERE id = p_referral_link_id;
END;
$$;

COMMENT ON FUNCTION public.update_referral_link_stats(uuid) IS 
'Updates referral link statistics: usage count, unique clients, last used date, and status';

-- Step 7: Create trigger to auto-update stats when usage is added/updated
CREATE OR REPLACE FUNCTION public.trigger_update_referral_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM public.update_referral_link_stats(NEW.referral_link_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.update_referral_link_stats(OLD.referral_link_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_referral_stats ON public.referral_link_usages;
CREATE TRIGGER trg_update_referral_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.referral_link_usages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_referral_stats();

-- Step 8: Create function to validate URL
CREATE OR REPLACE FUNCTION public.validate_referral_url(p_url text)
RETURNS public.url_validation_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized text;
BEGIN
    normalized := public.normalize_referral_url(p_url);
    
    IF normalized IS NULL THEN
        RETURN 'invalid'::public.url_validation_status;
    END IF;
    
    -- Check for common issues
    IF p_url ~* '\s' THEN
        RETURN 'needs_review'::public.url_validation_status; -- Has spaces
    END IF;
    
    IF p_url !~* '^https?://' THEN
        RETURN 'needs_review'::public.url_validation_status; -- Missing protocol
    END IF;
    
    RETURN 'valid'::public.url_validation_status;
END;
$$;

COMMENT ON FUNCTION public.validate_referral_url(text) IS 
'Validates referral URL and returns validation status';

-- Step 9: Create view for referral statistics
CREATE OR REPLACE VIEW public.referral_link_stats AS
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

-- Step 10: Enable RLS on new table
ALTER TABLE public.referral_link_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_link_usages authenticated full access"
    ON public.referral_link_usages
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 11: Initialize normalized_url and code for existing records
DO $$
DECLARE
    rec RECORD;
    normalized_url_val text;
    code_val text;
    validation_status_val public.url_validation_status;
BEGIN
    FOR rec IN SELECT id, url FROM public.referral_links WHERE normalized_url IS NULL
    LOOP
        normalized_url_val := public.normalize_referral_url(rec.url);
        code_val := public.extract_referral_code(rec.url);
        validation_status_val := public.validate_referral_url(rec.url);
        
        UPDATE public.referral_links
        SET 
            normalized_url = normalized_url_val,
            code = code_val,
            url_validation_status = validation_status_val
        WHERE id = rec.id;
    END LOOP;
END $$;

-- Step 12: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0033 completed: Enhanced referral tracking system';
    RAISE NOTICE '   - Added account_name, code, status, normalized_url, url_validation_status to referral_links';
    RAISE NOTICE '   - Created referral_link_usages table for detailed usage tracking';
    RAISE NOTICE '   - Added functions: normalize_referral_url, extract_referral_code, validate_referral_url';
    RAISE NOTICE '   - Added function: update_referral_link_stats (auto-updates on usage changes)';
    RAISE NOTICE '   - Created referral_link_stats view for aggregated statistics';
    RAISE NOTICE '   - Added indexes for performance';
END $$;


