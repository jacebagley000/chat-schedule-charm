DROP POLICY IF EXISTS "Owners/admins can add members" ON public.business_members;

CREATE POLICY "Owners/admins can add members"
ON public.business_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_business_role(auth.uid(), business_id, ARRAY['owner','admin']::business_role[])
);