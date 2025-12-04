-- Migration: Add error_irrecoverable field to client_apps
-- This field, when true, hides the app from the client view

-- Add error_irrecoverable column to client_apps
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'client_apps' 
        AND column_name = 'error_irrecoverable'
    ) THEN
        ALTER TABLE public.client_apps 
        ADD COLUMN error_irrecoverable boolean NOT NULL DEFAULT false;
        
        COMMENT ON COLUMN public.client_apps.error_irrecoverable IS 
        'If true, this app is marked as having an irrecoverable error and should be hidden from the client view.';
    END IF;
END $$;

