-- AUTH-3 (project-docs/nestyk-auth3-saved-rooms-plan-20261113.md, Mos approved 13 Nov 2026): rooms a signed-in
-- account saved with the heart on the guest web. Any role may save (D5). The API keeps at most 200 per account and
-- lists only rooms that are public now; a room that goes private stays saved and shows again if published again.
-- Undo: DROP TABLE public.saved_rooms; (the saved rooms are lost; no other table changes).
CREATE TABLE public.saved_rooms (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  rent_room_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_rooms_user_room_key UNIQUE (user_id, rent_room_id),
  CONSTRAINT saved_rooms_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT saved_rooms_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms (id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_rooms_user_created ON public.saved_rooms (user_id, created_at);
CREATE INDEX idx_saved_rooms_rent_room_id ON public.saved_rooms (rent_room_id);

ALTER TABLE public.saved_rooms ENABLE ROW LEVEL SECURITY;
