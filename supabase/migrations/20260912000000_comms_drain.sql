-- Phase 8 — claim RPC for the communications drain.
--
-- pg_cron + pg_net are not scheduled here: they need a production URL and
-- COMMS_DRAIN_SECRET. See docs/plans/phase-08-provider-adapters.md.

CREATE OR REPLACE FUNCTION public.claim_queued_communications(_limit integer)
RETURNS SETOF public.communications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT c.id
    FROM public.communications c
    WHERE (
      c.status = 'queued' AND c.scheduled_for <= now()
    ) OR (
      c.status = 'sending' AND c.scheduled_for <= now() - interval '5 minutes'
    )
    ORDER BY c.scheduled_for
    LIMIT GREATEST(COALESCE(_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.communications AS c
  SET status = 'sending', scheduled_for = now()
  FROM due
  WHERE c.id = due.id
  RETURNING c.*;
END;
$$;

COMMENT ON FUNCTION public.claim_queued_communications(integer) IS
  'Claims due outbox rows for the drain. service_role only.';

REVOKE ALL ON FUNCTION public.claim_queued_communications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_communications(integer) TO service_role;
