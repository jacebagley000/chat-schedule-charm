ALTER TABLE public.appointments REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;