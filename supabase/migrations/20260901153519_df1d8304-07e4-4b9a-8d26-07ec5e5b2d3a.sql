CREATE TABLE public.index_coverage_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  site_url TEXT,
  allowlisted_count INTEGER NOT NULL DEFAULT 0,
  indexed_count INTEGER NOT NULL DEFAULT 0,
  crawled_count INTEGER NOT NULL DEFAULT 0,
  sitemap_submitted INTEGER NOT NULL DEFAULT 0,
  sitemap_indexed INTEGER NOT NULL DEFAULT 0,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date)
);

GRANT SELECT, INSERT, UPDATE ON public.index_coverage_snapshots TO authenticated;
GRANT ALL ON public.index_coverage_snapshots TO service_role;

ALTER TABLE public.index_coverage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view coverage snapshots"
ON public.index_coverage_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can record coverage snapshots"
ON public.index_coverage_snapshots FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coverage snapshots"
ON public.index_coverage_snapshots FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));