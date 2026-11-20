-- Self owner rooms (docs/ROLE-CHANGE-PLAN.md 5.3 D4, decided 20 Nov 2026 by Jom on QA Aof's proposal): rooms an owner
-- lists without an agent live in their own tables, apart from the agent rooms (rent_rooms), so the two never mix and
-- may grow different fields. Buildings / projects are shared: properties holds no room or owner data.
-- New tables only; rent_rooms and the agent tables are untouched.
-- Undo (all self owner rooms, prices, photos and facilities are lost):
--   DROP TABLE public.self_owner_room_facilities, public.self_owner_room_medias, public.self_owner_room_prices,
--              public.self_owner_rooms;

CREATE TABLE public.self_owner_rooms (
  id serial PRIMARY KEY,
  owner_user_id integer NOT NULL,
  properties_id integer NOT NULL,
  room_type_id integer,
  room_status_id integer NOT NULL,
  visibility character varying(20) NOT NULL DEFAULT 'private',
  room_name character varying(255) NOT NULL,
  room_number character varying(100),
  bedrooms smallint NOT NULL,
  bathrooms smallint NOT NULL,
  size_sqm numeric(8,2),
  floor character varying(20),
  building character varying(100),
  available_from_date date NOT NULL DEFAULT CURRENT_DATE,
  advance_rent_months smallint NOT NULL DEFAULT 1,
  deposit_months smallint NOT NULL DEFAULT 2,
  water_rate_per_unit numeric(12,2),
  electric_rate_per_unit numeric(12,2),
  latitude numeric(10,7),
  longitude numeric(10,7),
  custom_facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  nearby_places jsonb NOT NULL DEFAULT '[]'::jsonb,
  promo_title character varying(255),
  listing_description text,
  contact_name character varying(255) NOT NULL,
  contact_phone character varying(50) NOT NULL,
  contact_line_id character varying(100),
  contact_facebook character varying(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_owner_rooms_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT self_owner_rooms_properties_id_fkey FOREIGN KEY (properties_id) REFERENCES public.properties (id) ON DELETE RESTRICT,
  CONSTRAINT self_owner_rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.master_room_types (id) ON DELETE RESTRICT,
  CONSTRAINT self_owner_rooms_room_status_id_fkey FOREIGN KEY (room_status_id) REFERENCES public.master_room_statuses (id) ON DELETE RESTRICT,
  CONSTRAINT chk_self_owner_rooms_visibility CHECK (visibility IN ('private', 'published')),
  CONSTRAINT chk_self_owner_rooms_bedrooms CHECK (bedrooms BETWEEN 0 AND 20),
  CONSTRAINT chk_self_owner_rooms_bathrooms CHECK (bathrooms BETWEEN 0 AND 20),
  CONSTRAINT chk_self_owner_rooms_size_sqm CHECK (size_sqm IS NULL OR size_sqm > 0),
  CONSTRAINT chk_self_owner_rooms_advance_rent_months CHECK (advance_rent_months BETWEEN 0 AND 12),
  CONSTRAINT chk_self_owner_rooms_deposit_months CHECK (deposit_months BETWEEN 0 AND 12)
);
CREATE INDEX idx_self_owner_rooms_owner_updated ON public.self_owner_rooms (owner_user_id, updated_at);
CREATE INDEX idx_self_owner_rooms_properties_id ON public.self_owner_rooms (properties_id);
COMMENT ON COLUMN public.self_owner_rooms.room_name IS 'Owner-only name of the room (the agent rooms call it listing_title)';

CREATE TABLE public.self_owner_room_prices (
  id serial PRIMARY KEY,
  room_id integer NOT NULL,
  contract_type_id integer NOT NULL,
  price numeric(12,2) NOT NULL,
  advance_rent_months smallint NOT NULL DEFAULT 1,
  deposit_months smallint NOT NULL DEFAULT 2,
  CONSTRAINT self_owner_room_prices_room_contract_key UNIQUE (room_id, contract_type_id),
  CONSTRAINT self_owner_room_prices_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.self_owner_rooms (id) ON DELETE CASCADE,
  CONSTRAINT self_owner_room_prices_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.master_contract_types (id) ON DELETE RESTRICT,
  CONSTRAINT chk_self_owner_room_prices_price CHECK (price > 0),
  CONSTRAINT chk_self_owner_room_prices_months CHECK (advance_rent_months BETWEEN 0 AND 12 AND deposit_months BETWEEN 0 AND 12)
);

CREATE TABLE public.self_owner_room_medias (
  id serial PRIMARY KEY,
  room_id integer NOT NULL,
  media_url character varying(500) NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT self_owner_room_medias_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.self_owner_rooms (id) ON DELETE CASCADE
);
CREATE INDEX idx_self_owner_room_medias_room_id ON public.self_owner_room_medias (room_id, sort_order);
CREATE UNIQUE INDEX uq_self_owner_room_medias_one_cover ON public.self_owner_room_medias (room_id) WHERE is_cover;

CREATE TABLE public.self_owner_room_facilities (
  id serial PRIMARY KEY,
  room_id integer NOT NULL,
  facility_id integer NOT NULL,
  CONSTRAINT self_owner_room_facilities_room_facility_key UNIQUE (room_id, facility_id),
  CONSTRAINT self_owner_room_facilities_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.self_owner_rooms (id) ON DELETE CASCADE,
  CONSTRAINT self_owner_room_facilities_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.master_facilities (id) ON DELETE RESTRICT
);

ALTER TABLE public.self_owner_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_owner_room_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_owner_room_medias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_owner_room_facilities ENABLE ROW LEVEL SECURITY;
