-- Co-agents can be added before they are linked to any room.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_co_agent boolean NOT NULL DEFAULT false;

UPDATE public.contacts c SET is_co_agent = true
WHERE NOT c.is_co_agent AND EXISTS (
  SELECT 1 FROM public.rent_room_contacts rrc
  JOIN public.rent_rooms r ON r.id = rrc.rent_room_id
  JOIN public.master_listing_sources source ON source.id = r.listing_source_id
  WHERE rrc.contact_id = c.id AND r.created_by_user_id = c.created_by_user_id
    AND r.is_scout_room = true AND source.code = 'co_agent'
);
