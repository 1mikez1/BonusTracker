-- Migration: Add webhook support for Calendly and Google Forms
-- This migration extends the requests table to support onboarding requests
-- and adds fields for webhook tracking.

-- Step 1: Extend request_status enum to include 'scheduled' for onboarding
DO $$
BEGIN
    -- Check if 'scheduled' already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'scheduled' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'request_status')
    ) THEN
        ALTER TYPE public.request_status ADD VALUE 'scheduled';
    END IF;
END $$;

-- Step 2: Add request_type to requests table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'requests' 
        AND column_name = 'request_type'
    ) THEN
        ALTER TABLE public.requests 
        ADD COLUMN request_type text DEFAULT 'submitted_form';
        
        COMMENT ON COLUMN public.requests.request_type IS 
        'Type of request: submitted_form (Google Forms), onboarding (Calendly), manual';
    END IF;
END $$;

-- Step 3: Add webhook metadata fields
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'requests' 
        AND column_name = 'webhook_source'
    ) THEN
        ALTER TABLE public.requests 
        ADD COLUMN webhook_source text;
        
        COMMENT ON COLUMN public.requests.webhook_source IS 
        'Source of the webhook: calendly, google_forms, manual';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'requests' 
        AND column_name = 'webhook_payload'
    ) THEN
        ALTER TABLE public.requests 
        ADD COLUMN webhook_payload jsonb;
        
        COMMENT ON COLUMN public.requests.webhook_payload IS 
        'Original webhook payload for debugging and audit';
    END IF;
END $$;

-- Step 4: Add email field to requests (for better matching)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'requests' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.requests 
        ADD COLUMN email text;
        
        COMMENT ON COLUMN public.requests.email IS 
        'Email address from webhook (for client matching)';
    END IF;
END $$;

-- Step 5: Add indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_requests_email 
ON public.requests(email) 
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_webhook_source 
ON public.requests(webhook_source) 
WHERE webhook_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_request_type 
ON public.requests(request_type) 
WHERE request_type IS NOT NULL;

-- Step 6: Add index on contact for faster client matching
CREATE INDEX IF NOT EXISTS idx_clients_contact 
ON public.clients(contact) 
WHERE contact IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_email 
ON public.clients(email) 
WHERE email IS NOT NULL;

-- Step 7: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0024 completed: Added webhook support';
    RAISE NOTICE '   - request_status enum extended with ''scheduled''';
    RAISE NOTICE '   - requests.request_type (text, default: submitted_form)';
    RAISE NOTICE '   - requests.webhook_source (text)';
    RAISE NOTICE '   - requests.webhook_payload (jsonb)';
    RAISE NOTICE '   - requests.email (text)';
    RAISE NOTICE '   - Indexes created for performance';
END $$;

