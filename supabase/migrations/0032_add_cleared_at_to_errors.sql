-- Migration: Add cleared_at field to client_errors table
-- This allows errors to be "cleared" (hidden from dashboard) without being resolved
-- Cleared errors won't reappear when "Detect Errors" is run again

-- Step 1: Add cleared_at column to client_errors table
ALTER TABLE public.client_errors
ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

COMMENT ON COLUMN public.client_errors.cleared_at IS 
'Timestamp when the error was cleared (hidden from dashboard). Different from resolved_at - cleared errors are dismissed but not necessarily fixed.';

-- Step 2: Add index for cleared_at
CREATE INDEX IF NOT EXISTS idx_client_errors_cleared 
ON public.client_errors(cleared_at) 
WHERE cleared_at IS NULL;

-- Step 3: Update detect_client_errors function to skip cleared errors
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
    v_completed_steps jsonb;
    total_steps integer;
    completed_count integer;
BEGIN
    -- Clear existing unresolved errors for this client
    DELETE FROM public.client_errors
    WHERE client_id = p_client_id
    AND resolved_at IS NULL
    AND cleared_at IS NULL;

    -- Error 1: Document rejected (request status = 'rejected')
    IF EXISTS (
        SELECT 1 FROM public.requests
        WHERE client_id = p_client_id
        AND status = 'rejected'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.client_errors
        WHERE client_id = p_client_id
        AND error_type = 'document_rejected'
        AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
        AND cleared_at IS NULL
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
        )
        ON CONFLICT (client_id, client_app_id, error_type, resolved_at) DO NOTHING;
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
        AND NOT EXISTS (
            SELECT 1 FROM public.client_errors
            WHERE client_id = p_client_id
            AND client_app_id = ca.id
            AND error_type = 'deadline_missed'
            AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
            AND cleared_at IS NULL
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
        AND NOT EXISTS (
            SELECT 1 FROM public.client_errors
            WHERE client_id = p_client_id
            AND client_app_id = ca.id
            AND error_type = 'referral_incoherent'
            AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
            AND cleared_at IS NULL
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
            -- Check if error already exists (resolved or unresolved, but not cleared)
            IF NOT EXISTS (
                SELECT 1 FROM public.client_errors
                WHERE client_id = p_client_id
                AND client_app_id = v_client_app_id
                AND error_type = 'missing_steps'
                AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
                AND cleared_at IS NULL
            ) THEN
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
        END IF;
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
        AND NOT EXISTS (
            SELECT 1 FROM public.client_errors
            WHERE client_id = p_client_id
            AND client_app_id = ca.id
            AND error_type = 'note_error'
            AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
            AND cleared_at IS NULL
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
        AND NOT EXISTS (
            SELECT 1 FROM public.client_errors
            WHERE client_id = p_client_id
            AND client_app_id = ca.id
            AND error_type = 'missing_deposit'
            AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
            AND cleared_at IS NULL
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
        AND NOT EXISTS (
            SELECT 1 FROM public.client_errors
            WHERE client_id = p_client_id
            AND client_app_id = ca.id
            AND error_type = 'status_mismatch'
            AND (resolved_at IS NULL OR resolved_at > NOW() - INTERVAL '24 hours')
            AND cleared_at IS NULL
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
'Detects and logs all errors for a specific client. Returns count of errors detected. Prevents duplicate errors if one was recently resolved (within 24 hours) or if it was cleared.';

