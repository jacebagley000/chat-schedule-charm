-- 1) Scope member policies to the authenticated role so anon requests return zero rows
--    instead of raising "permission denied for function is_business_member".

DROP POLICY IF EXISTS "Members can manage appointments" ON public.appointments;
CREATE POLICY "Members can manage appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view appointments" ON public.appointments;
CREATE POLICY "Members can view appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can view memberships of their businesses" ON public.business_members;
CREATE POLICY "Members can view memberships of their businesses" ON public.business_members FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Owners/admins can remove memberships" ON public.business_members;
CREATE POLICY "Owners/admins can remove memberships" ON public.business_members FOR DELETE TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner'::business_role,'admin'::business_role]));
DROP POLICY IF EXISTS "Owners/admins can update memberships" ON public.business_members;
CREATE POLICY "Owners/admins can update memberships" ON public.business_members FOR UPDATE TO authenticated
  USING (public.has_business_role(auth.uid(), business_id, ARRAY['owner'::business_role,'admin'::business_role]));

DROP POLICY IF EXISTS "Authenticated users can create a business" ON public.businesses;
CREATE POLICY "Authenticated users can create a business" ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Members can view their businesses" ON public.businesses;
CREATE POLICY "Members can view their businesses" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), id));
DROP POLICY IF EXISTS "Owners and admins can update their business" ON public.businesses;
CREATE POLICY "Owners and admins can update their business" ON public.businesses FOR UPDATE TO authenticated
  USING (public.has_business_role(auth.uid(), id, ARRAY['owner'::business_role,'admin'::business_role]));
DROP POLICY IF EXISTS "Owners can delete their business" ON public.businesses;
CREATE POLICY "Owners can delete their business" ON public.businesses FOR DELETE TO authenticated
  USING (public.has_business_role(auth.uid(), id, ARRAY['owner'::business_role]));

DROP POLICY IF EXISTS "Members can manage conversations" ON public.conversations;
CREATE POLICY "Members can manage conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can manage customers" ON public.customers;
CREATE POLICY "Members can manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view customers" ON public.customers;
CREATE POLICY "Members can view customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can manage messages" ON public.messages;
CREATE POLICY "Members can manage messages" ON public.messages FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can manage scheduling requests" ON public.scheduling_requests;
CREATE POLICY "Members can manage scheduling requests" ON public.scheduling_requests FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view scheduling requests" ON public.scheduling_requests;
CREATE POLICY "Members can view scheduling requests" ON public.scheduling_requests FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can manage services" ON public.services;
CREATE POLICY "Members can manage services" ON public.services FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view services" ON public.services;
CREATE POLICY "Members can view services" ON public.services FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members can manage staff" ON public.staff;
CREATE POLICY "Members can manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
DROP POLICY IF EXISTS "Members can view staff" ON public.staff;
CREATE POLICY "Members can view staff" ON public.staff FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- 2) Realtime for leads
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;