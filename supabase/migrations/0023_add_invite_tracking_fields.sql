-- Migration: Add invite tracking and rewrite flags to clients and referral_links
-- This migration adds structured fields for tracking invitations and flags,
-- removing the need to store this data in notes.

-- Step 1: Add missing fields to clients table
-- Check if fields exist before adding to make migration idempotent

-- Add invited_by_name if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'invited_by_name'
    ) THEN
        ALTER TABLE public.clients 
        ADD COLUMN invited_by_name text;
        
        COMMENT ON COLUMN public.clients.invited_by_name IS 
        'Name of the person who invited this client (string, not UUID). Used when invited_by_client_id is not available.';
    END IF;
END $$;

-- Add needs_rewrite if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'needs_rewrite'
    ) THEN
        ALTER TABLE public.clients 
        ADD COLUMN needs_rewrite boolean NOT NULL DEFAULT false;
        
        COMMENT ON COLUMN public.clients.needs_rewrite IS 
        'Flag indicating if client needs to be rewritten (RISCRIVERE flag).';
    END IF;
END $$;

-- Add rewritten if not exists (new field)
-- Note: rewrite_j already exists, but we add rewritten as a separate field
-- to track the RISCRIVE flag specifically
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'rewritten'
    ) THEN
        ALTER TABLE public.clients 
        ADD COLUMN rewritten boolean NOT NULL DEFAULT false;
        
        COMMENT ON COLUMN public.clients.rewritten IS 
        'Flag indicating if client has been rewritten (RISCRIVE flag). Separate from rewrite_j.';
    END IF;
END $$;

-- Step 2: Create enum type for referral link invitation type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_type') THEN
        CREATE TYPE public.invite_type AS ENUM (
            'manuale',
            'referral',
            'generato'
        );
        
        COMMENT ON TYPE public.invite_type IS 
        'Type of invitation: manuale (manually entered), referral (from referral link), generato (auto-generated).';
    END IF;
END $$;

-- Step 3: Add fields to referral_links table
-- Add linked_client (alias for owner_client_id, but we'll keep owner_client_id for backward compatibility)
-- Note: owner_client_id already exists, so we'll use it as linked_client

-- Add tipo_invito if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links' 
        AND column_name = 'tipo_invito'
    ) THEN
        ALTER TABLE public.referral_links 
        ADD COLUMN tipo_invito public.invite_type;
        
        COMMENT ON COLUMN public.referral_links.tipo_invito IS 
        'Type of invitation: manuale, referral, or generato.';
    END IF;
END $$;

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_invited_by_name 
ON public.clients(invited_by_name) 
WHERE invited_by_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_needs_rewrite 
ON public.clients(needs_rewrite) 
WHERE needs_rewrite = true;

CREATE INDEX IF NOT EXISTS idx_clients_rewritten 
ON public.clients(rewritten) 
WHERE rewritten = true;

CREATE INDEX IF NOT EXISTS idx_referral_links_tipo_invito 
ON public.referral_links(tipo_invito) 
WHERE tipo_invito IS NOT NULL;

-- Step 5: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0023 completed: Added invite tracking and rewrite flags';
    RAISE NOTICE '   - clients.invited_by_name (text)';
    RAISE NOTICE '   - clients.needs_rewrite (boolean, default false)';
    RAISE NOTICE '   - clients.rewritten (boolean, default false)';
    RAISE NOTICE '   - referral_links.tipo_invito (enum: manuale, referral, generato)';
    RAISE NOTICE '   - Indexes created for performance';
END $$;

