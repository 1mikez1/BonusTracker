-- Migration: Fix requests table foreign key to allow CASCADE delete
-- This allows clients to be deleted even when they have associated requests
-- Requests will be deleted when the client is deleted

-- Step 1: Drop the existing foreign key constraint
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'requests' 
        AND constraint_name = 'requests_client_id_fkey'
    ) THEN
        ALTER TABLE public.requests 
        DROP CONSTRAINT requests_client_id_fkey;
        
        RAISE NOTICE 'Dropped existing requests_client_id_fkey constraint';
    END IF;
END $$;

-- Step 2: Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.requests
ADD CONSTRAINT requests_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.clients(id) 
ON DELETE CASCADE;

-- Step 3: Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0029 completed: Fixed requests CASCADE delete';
    RAISE NOTICE '   - requests.client_id now has ON DELETE CASCADE';
    RAISE NOTICE '   - Clients can now be deleted even with associated requests';
END $$;

