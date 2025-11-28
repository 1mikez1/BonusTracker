-- Migration: Add error detection system for clients and client_apps
-- This migration adds error tracking and automatic error detection

-- Step 1: Create error_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'error_type') THEN
        CREATE TYPE public.error_type AS ENUM (
            'document_rejected',
            'deadline_missed',
            'referral_incoherent',
            'missing_steps',
            'note_error',
            'csv_import_incoherent',
            'missing_deposit',
            'stale_update',
            'status_mismatch'
        );
        
        COMMENT ON TYPE public.error_type IS 
        'Types of errors that can be detected automatically.';
    END IF;
END $$;

-- Step 2: Create client_errors table
CREATE TABLE IF NOT EXISTS public.client_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    client_app_id uuid REFERENCES public.client_apps(id) ON DELETE CASCADE,
    error_type public.error_type NOT NULL,
    severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    title text NOT NULL,
    description text,
    detected_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id),
    metadata jsonb,
    CONSTRAINT client_errors_unique UNIQUE (client_id, client_app_id, error_type, resolved_at)
);

COMMENT ON TABLE public.client_errors IS 
'Automatic error detection log. Errors are detected and logged, can be resolved manually.';

COMMENT ON COLUMN public.client_errors.severity IS 
'Severity level: critical (red badge), warning (orange), info (blue).';

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_client_errors_client 
ON public.client_errors(client_id);

CREATE INDEX IF NOT EXISTS idx_client_errors_client_app 
ON public.client_errors(client_app_id) 
WHERE client_app_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_errors_type 
ON public.client_errors(error_type);

CREATE INDEX IF NOT EXISTS idx_client_errors_resolved 
ON public.client_errors(resolved_at) 
WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_errors_severity 
ON public.client_errors(severity);

-- Step 4: Create function to detect errors for a client
CREATE OR REPLACE FUNCTION public.detect_client_errors(p_client_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    detected_count integer := 0;
    v_client_app_id uuid;
    v_deadline_at timestamptz;
    v_status text;
    v_deposited boolean;
    v_finished boolean;
    v_deadline_days integer;
    v_started_at timestamptz;
    v_notes text;
    v_referral_link_id uuid;
    v_app_id uuid;
    v_app_name text;
BEGIN
    -- Clear existing unresolved errors for this client
    DELETE FROM public.client_errors
    WHERE client_id = p_client_id
    AND resolved_at IS NULL;

    -- Error 1: Document rejected (request status = 'rejected')
    IF EXISTS (
        SELECT 1 FROM public.requests
        WHERE client_id = p_client_id
        AND status = 'rejected'
    ) THEN
        INSERT INTO public.client_errors (
            client_id,
            error_type,
            severity,
            title,
            description
        ) VALUES (
            p_client_id,
            'document_rejected',
            'critical',
            'Document Rejected',
            'One or more requests for this client have been rejected.'
        );
        detected_count := detected_count + 1;
    END IF;

    -- Error 2: Deadline missed (deadline passed and not completed/paid)
    FOR v_client_app_id, v_deadline_at, v_status, v_app_name IN
        SELECT 
            ca.id,
            ca.deadline_at,
            ca.status,
            a.name
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.deadline_at IS NOT NULL
        AND ca.deadline_at < NOW()
        AND ca.status NOT IN ('completed', 'paid', 'cancelled')
    LOOP
        INSERT INTO public.client_errors (
            client_id,
            client_app_id,
            error_type,
            severity,
            title,
            description,
            metadata
        ) VALUES (
            p_client_id,
            v_client_app_id,
            'deadline_missed',
            'critical',
            'Deadline Missed: ' || v_app_name,
            'Bonus deadline has passed but status is not completed or paid.',
            jsonb_build_object(
                'deadline_at', v_deadline_at,
                'current_status', v_status,
                'days_overdue', EXTRACT(DAY FROM NOW() - v_deadline_at)::integer
            )
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
        detected_count := detected_count + 1;
    END LOOP;

    -- Error 3: Referral incoherent (referral_link_id set but no matching referral_links)
    FOR v_client_app_id, v_referral_link_id, v_app_name IN
        SELECT 
            ca.id,
            ca.referral_link_id,
            a.name
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.referral_link_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.referral_links rl
            WHERE rl.id = ca.referral_link_id
        )
    LOOP
        INSERT INTO public.client_errors (
            client_id,
            client_app_id,
            error_type,
            severity,
            title,
            description
        ) VALUES (
            p_client_id,
            v_client_app_id,
            'referral_incoherent',
            'warning',
            'Referral Incoherent: ' || v_app_name,
            'Referral link ID exists but link not found in database.'
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
        detected_count := detected_count + 1;
    END LOOP;

    -- Error 4: Missing steps (onboarding steps incomplete for active apps)
    -- This is a simplified check - can be enhanced based on actual step tracking logic
    FOR v_client_app_id, v_app_name, v_completed_steps IN
        SELECT 
            ca.id,
            a.name,
            ca.completed_steps
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.status NOT IN ('completed', 'paid', 'cancelled')
        AND EXISTS (
            SELECT 1 FROM public.message_templates mt
            WHERE mt.app_id = ca.app_id
            AND mt.step_order IS NOT NULL
        )
    LOOP
        -- Check if there are missing steps by comparing with message_templates
        DECLARE
            total_steps integer;
            completed_count integer;
        BEGIN
            -- Count total steps for this app
            SELECT COUNT(*) INTO total_steps
            FROM public.message_templates
            WHERE app_id = (SELECT app_id FROM public.client_apps WHERE id = v_client_app_id)
            AND step_order IS NOT NULL;

            -- Count completed steps
            IF v_completed_steps IS NOT NULL THEN
                SELECT jsonb_array_length(v_completed_steps::jsonb) INTO completed_count;
            ELSE
                completed_count := 0;
            END IF;

            -- If there are steps but not all completed, flag as error
            IF total_steps > 0 AND completed_count < total_steps THEN
                INSERT INTO public.client_errors (
                    client_id,
                    client_app_id,
                    error_type,
                    severity,
                    title,
                    description,
                    metadata
                ) VALUES (
                    p_client_id,
                    v_client_app_id,
                    'missing_steps',
                    'warning',
                    'Missing Steps: ' || v_app_name,
                    'Some onboarding steps are not completed.',
                    jsonb_build_object(
                        'total_steps', total_steps,
                        'completed_steps', completed_count
                    )
                )
                ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
                detected_count := detected_count + 1;
            END IF;
        END;
    END LOOP;

    -- Error 5: Note contains "errore" or "error"
    FOR v_client_app_id, v_notes, v_app_name IN
        SELECT 
            ca.id,
            ca.notes,
            a.name
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.notes IS NOT NULL
        AND (
            LOWER(ca.notes) LIKE '%errore%' OR
            LOWER(ca.notes) LIKE '%error%' OR
            LOWER(ca.notes) LIKE '%problema%' OR
            LOWER(ca.notes) LIKE '%issue%'
        )
    LOOP
        INSERT INTO public.client_errors (
            client_id,
            client_app_id,
            error_type,
            severity,
            title,
            description,
            metadata
        ) VALUES (
            p_client_id,
            v_client_app_id,
            'note_error',
            'warning',
            'Error in Notes: ' || v_app_name,
            'Notes contain error-related keywords.',
            jsonb_build_object('note_preview', LEFT(v_notes, 100))
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
        detected_count := detected_count + 1;
    END LOOP;

    -- Error 6: Missing deposit (status = registered but deposited = false)
    FOR v_client_app_id, v_app_name IN
        SELECT 
            ca.id,
            a.name
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.status = 'registered'
        AND ca.deposited = false
    LOOP
        INSERT INTO public.client_errors (
            client_id,
            client_app_id,
            error_type,
            severity,
            title,
            description
        ) VALUES (
            p_client_id,
            v_client_app_id,
            'missing_deposit',
            'warning',
            'Missing Deposit: ' || v_app_name,
            'Status is registered but deposit flag is not set.'
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
        detected_count := detected_count + 1;
    END LOOP;

    -- Error 7: Status mismatch (deposited=true but status not deposited/waiting_bonus/completed/paid)
    FOR v_client_app_id, v_status, v_deposited, v_app_name IN
        SELECT 
            ca.id,
            ca.status,
            ca.deposited,
            a.name
        FROM public.client_apps ca
        JOIN public.apps a ON a.id = ca.app_id
        WHERE ca.client_id = p_client_id
        AND ca.deposited = true
        AND ca.status NOT IN ('deposited', 'waiting_bonus', 'completed', 'paid')
    LOOP
        INSERT INTO public.client_errors (
            client_id,
            client_app_id,
            error_type,
            severity,
            title,
            description,
            metadata
        ) VALUES (
            p_client_id,
            v_client_app_id,
            'status_mismatch',
            'warning',
            'Status Mismatch: ' || v_app_name,
            'Deposit flag is set but status does not reflect it.',
            jsonb_build_object(
                'current_status', v_status,
                'deposited', v_deposited
            )
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
        detected_count := detected_count + 1;
    END LOOP;

    RETURN detected_count;
END;
$$;

COMMENT ON FUNCTION public.detect_client_errors(uuid) IS 
'Detects and logs all errors for a specific client. Returns count of errors detected.';

-- Step 5: Create function to detect errors for all clients
CREATE OR REPLACE FUNCTION public.detect_all_client_errors()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    total_detected integer := 0;
    v_client_id uuid;
BEGIN
    -- Process all clients
    FOR v_client_id IN
        SELECT id FROM public.clients
    LOOP
        total_detected := total_detected + public.detect_client_errors(v_client_id);
    END LOOP;

    RETURN total_detected;
END;
$$;

COMMENT ON FUNCTION public.detect_all_client_errors() IS 
'Detects errors for all clients. Useful for batch processing or scheduled jobs.';

-- Step 6: Enable RLS
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_errors authenticated full access"
    ON public.client_errors
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 7: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 0028 completed: Added error detection system';
    RAISE NOTICE '   - error_type enum (9 error types)';
    RAISE NOTICE '   - client_errors table (error log)';
    RAISE NOTICE '   - Function detect_client_errors(client_id)';
    RAISE NOTICE '   - Function detect_all_client_errors()';
    RAISE NOTICE '   - Indexes created for performance';
END $$;

