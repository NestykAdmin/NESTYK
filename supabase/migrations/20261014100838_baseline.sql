-- NESTYK baseline schema (public), dumped from local docker after every apps/api/migrations/*.sql
-- was applied and the TypeORM entities matched the database (2026-10-14).
-- Apply with `npm run db:push -w @nestyk/api`; the script records it in supabase_migrations.schema_migrations.
-- The last block enables RLS and removes anon / authenticated access (apps/api/migrations/20261009-lock-down-data-api.sql),
-- because hosted Supabase grants those roles on every new table by default.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: protect_agreement_document(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_agreement_document() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO '\$user', 'public', 'extensions'
    AS $$
DECLARE c RECORD; old_doc RECORD; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM lease_contracts WHERE id=NEW.agreement_id FOR UPDATE;
  IF c.status NOT IN ('draft','awaiting_signatures','awaiting_agent_review')
     OR (c.document_url IS NOT NULL AND c.document_url LIKE '%/generated/reservation_letter/%') THEN
    RAISE EXCEPTION 'Signed or closed agreement documents cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
    IF OLD.removed_at IS NOT NULL OR NEW.removed_at IS NULL OR
      (to_jsonb(NEW)-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'removed_at') OR
      EXISTS(SELECT 1 FROM agreement_documents WHERE supersedes_document_id=OLD.id) THEN
      RAISE EXCEPTION 'Only a current document can be removed' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Removed documents cannot be changed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['review_status','reviewed_by_user_id','reviewed_at','review_note']) OR OLD.review_status <> 'pending' THEN
      RAISE EXCEPTION 'Add a new document revision instead of changing document history' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.supersedes_document_id IS NOT NULL THEN
    SELECT * INTO old_doc FROM agreement_documents WHERE id=NEW.supersedes_document_id;
    IF old_doc.removed_at IS NOT NULL OR old_doc.agreement_id <> NEW.agreement_id OR old_doc.subject <> NEW.subject OR old_doc.document_type_code <> NEW.document_type_code THEN
      RAISE EXCEPTION 'Replacement must match agreement, subject and document type' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_agreement_requirements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_agreement_requirements() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO '\$user', 'public', 'extensions'
    AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM lease_contracts WHERE template_id = CASE WHEN TG_OP='DELETE' THEN OLD.template_id ELSE NEW.template_id END)
    OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM lease_contracts WHERE template_id=OLD.template_id)) THEN
    RAISE EXCEPTION 'Create a new template version to change document requirements';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;


--
-- Name: protect_agreement_template(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_agreement_template() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (to_jsonb(NEW) - 'is_active') IS DISTINCT FROM (to_jsonb(OLD) - 'is_active') THEN
    RAISE EXCEPTION 'Create a new template version instead of modifying an existing version';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_deposit_contract_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_deposit_contract_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.tenant_id, NEW.rent_room_id, NEW.previous_agreement_id, NEW.agreement_kind, NEW.start_date, NEW.end_date, NEW.deposit)
    IS DISTINCT FROM
    (OLD.tenant_id, OLD.rent_room_id, OLD.previous_agreement_id, OLD.agreement_kind, OLD.start_date, OLD.end_date, OLD.deposit)
    AND EXISTS (SELECT 1 FROM contract_deposit_transfers
      WHERE (from_contract_id = OLD.id OR to_contract_id = OLD.id) AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Cancel pending deposit allocation before changing contract terms' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('cancelled','terminated') AND NEW.status IS DISTINCT FROM OLD.status AND
    EXISTS (SELECT 1 FROM contract_deposit_transfers t JOIN contract_deposit_settlements s
      ON s.lease_contract_id = t.from_contract_id
      WHERE t.to_contract_id = OLD.id AND t.status = 'pending' AND s.status <> 'draft') THEN
    RAISE EXCEPTION 'Resolve approved deposit allocation before cancelling its renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_deposit_deduction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_deposit_deduction() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE parent_status VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.settlement_id <> OLD.settlement_id THEN
    RAISE EXCEPTION 'Deduction cannot move to another settlement' USING ERRCODE = '23514';
  END IF;
  SELECT status INTO parent_status FROM contract_deposit_settlements
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.settlement_id ELSE NEW.settlement_id END FOR UPDATE;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft settlement deductions may be changed' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_used_contract_end_reason(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_used_contract_end_reason() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['is_active','sort_order']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['is_active','sort_order']) AND
    EXISTS (SELECT 1 FROM lease_contracts WHERE end_reason_id = OLD.id) THEN
    RAISE EXCEPTION 'Create a new reason instead of changing a used reason' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: require_agreement_documents_before_signing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_agreement_documents_before_signing() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO '\$user', 'public', 'extensions'
    AS $$
BEGIN
  IF OLD.owner_signed_at IS NULL AND OLD.tenant_signed_at IS NULL AND OLD.agent_signed_at IS NULL
    AND (NEW.owner_signed_at IS NOT NULL OR NEW.tenant_signed_at IS NOT NULL OR NEW.agent_signed_at IS NOT NULL)
    AND EXISTS (
      SELECT r.group_key FROM agreement_template_document_requirements r WHERE r.template_id=NEW.template_id
      GROUP BY r.group_key HAVING NOT bool_or(EXISTS(
        SELECT 1 FROM agreement_documents d WHERE d.agreement_id=NEW.id AND d.subject=r.subject
          AND d.document_type_code=r.document_type_code AND d.removed_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM agreement_documents next WHERE next.supersedes_document_id=d.id)
      ))
    ) THEN RAISE EXCEPTION 'Required agreement documents must be attached before signing' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_contract_end_reason(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_contract_end_reason() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE reason master_contract_end_reasons%ROWTYPE;
BEGIN
  IF NEW.end_reason_id IS NULL THEN
    -- Existing closed rows remain readable/editable without inventing their history.
    IF (TG_OP = 'INSERT' AND NEW.status IN ('expired','terminated','cancelled')) OR
      (TG_OP = 'UPDATE' AND (OLD.end_reason_id IS NOT NULL OR
       (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('expired','terminated','cancelled')))) THEN
      RAISE EXCEPTION 'New contract closure requires an end reason' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO reason FROM master_contract_end_reasons WHERE id = NEW.end_reason_id;
  IF NOT FOUND OR reason.applicable_status <> NEW.status THEN
    RAISE EXCEPTION 'End reason must match contract status' USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.end_reason_id IS DISTINCT FROM OLD.end_reason_id) AND NOT reason.is_active THEN
    RAISE EXCEPTION 'Inactive end reason cannot be selected' USING ERRCODE = '23514';
  END IF;
  IF reason.requires_note AND NULLIF(BTRIM(NEW.end_reason_note), '') IS NULL THEN
    RAISE EXCEPTION 'This end reason requires a note' USING ERRCODE = '23514';
  END IF;
  IF NEW.effective_end_date IS NULL OR NEW.end_recorded_at IS NULL THEN
    RAISE EXCEPTION 'Contract end requires effective date and recorded time' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'expired' AND (NEW.end_date IS NULL OR NEW.effective_end_date <> NEW.end_date) THEN
    RAISE EXCEPTION 'Expired contract must retain its scheduled end date' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'terminated' AND (NEW.effective_end_date < NEW.start_date OR
    (NEW.end_date IS NOT NULL AND NEW.effective_end_date >= NEW.end_date)) THEN
    RAISE EXCEPTION 'Early termination date must fall within the contract term' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_deposit_settlement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_deposit_settlement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE incoming NUMERIC; deductions NUMERIC; outgoing NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Approved settlement cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM contract_deposit_transfers WHERE from_contract_id = OLD.lease_contract_id AND status <> 'cancelled') THEN
      RAISE EXCEPTION 'Cancel pending transfers before deleting draft settlement' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'Create a draft settlement before approval' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.lease_contract_id <> OLD.lease_contract_id THEN
      RAISE EXCEPTION 'Settlement contract cannot be changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'draft' AND
      (to_jsonb(NEW) - ARRAY['status','refunded_at','refund_reference','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','refunded_at','refund_reference','updated_at']) THEN
      RAISE EXCEPTION 'Approved settlement amounts and approval are immutable' USING ERRCODE = '23514';
    END IF;
    IF (OLD.status = 'approved' AND NEW.status = 'draft') OR
       (OLD.status = 'completed' AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')) THEN
      RAISE EXCEPTION 'Settlement cannot be reopened or completed proof changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.refunded_at IS NOT NULL AND
      (NEW.refunded_at IS DISTINCT FROM OLD.refunded_at OR NEW.refund_reference IS DISTINCT FROM OLD.refund_reference) THEN
      RAISE EXCEPTION 'Recorded refund proof is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'draft' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM lease_contracts WHERE id = NEW.lease_contract_id AND status IN ('expired','terminated','cancelled')) THEN
    RAISE EXCEPTION 'Only ended contracts can approve a final deposit settlement' USING ERRCODE = '23514';
  END IF;
  IF NEW.deposit_received_amount > 0 AND NULLIF(BTRIM(NEW.deposit_received_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Actual deposit receipt requires evidence' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO incoming FROM contract_deposit_transfers
    WHERE to_contract_id = NEW.lease_contract_id AND status = 'completed';
  SELECT COALESCE(SUM(amount), 0) INTO deductions FROM deposit_deduction_items WHERE settlement_id = NEW.id;
  SELECT COALESCE(SUM(amount), 0) INTO outgoing FROM contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status <> 'cancelled';
  IF NEW.available_deposit_amount <> NEW.deposit_received_amount + incoming OR
     NEW.deduction_total <> deductions OR NEW.carried_forward_total <> outgoing THEN
    RAISE EXCEPTION 'Settlement must reconcile actual receipts, deductions and transfers' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND EXISTS (SELECT 1 FROM contract_deposit_transfers
    WHERE from_contract_id = NEW.lease_contract_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Complete outgoing transfers before closing settlement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_deposit_transfer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_deposit_transfer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE source lease_contracts%ROWTYPE; destination lease_contracts%ROWTYPE;
  source_settlement contract_deposit_settlements%ROWTYPE; destination_status VARCHAR;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cancel a pending transfer instead of deleting its history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Create a pending transfer before completion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Completed or cancelled transfer is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.from_contract_id <> OLD.from_contract_id OR NEW.to_contract_id <> OLD.to_contract_id) THEN
    RAISE EXCEPTION 'Transfer contracts cannot be changed' USING ERRCODE = '23514';
  END IF;
  -- Serialize with approval and other money operations on both contracts.
  PERFORM id FROM contract_deposit_settlements
    WHERE lease_contract_id IN (NEW.from_contract_id, NEW.to_contract_id) ORDER BY id FOR UPDATE;
  SELECT * INTO source_settlement FROM contract_deposit_settlements WHERE lease_contract_id = NEW.from_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source requires a deposit settlement' USING ERRCODE = '23514'; END IF;
  SELECT status INTO destination_status FROM contract_deposit_settlements WHERE lease_contract_id = NEW.to_contract_id;
  IF source_settlement.status <> 'draft' AND NOT
    (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'completed' AND
     source_settlement.status = 'approved' AND NEW.amount = OLD.amount AND
     NEW.created_by_user_id = OLD.created_by_user_id) THEN
    RAISE EXCEPTION 'Approved transfer allocation cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT * INTO source FROM lease_contracts WHERE id = NEW.from_contract_id;
  SELECT * INTO destination FROM lease_contracts WHERE id = NEW.to_contract_id;
  IF source.id IS NULL OR destination.id IS NULL OR
    destination.previous_agreement_id IS DISTINCT FROM source.id OR destination.agreement_kind <> 'renewal' OR
    source.tenant_id <> destination.tenant_id OR source.rent_room_id <> destination.rent_room_id OR
    source.end_date IS NULL OR destination.start_date <= source.end_date OR
    destination.status IN ('cancelled', 'terminated', 'expired') OR
    destination.deposit IS NULL OR NEW.amount > destination.deposit THEN
    RAISE EXCEPTION 'Deposit transfer must target the direct renewal for the same tenant and room' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'completed' AND (source_settlement.status <> 'approved' OR source.status <> 'expired' OR
    destination.status <> 'active' OR destination_status IN ('approved','completed')) THEN
    RAISE EXCEPTION 'Transfer needs an approved source settlement, expired predecessor and active renewal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_commission_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_commission_confirmations (
    id integer NOT NULL,
    created_by_user_id integer NOT NULL,
    document_no character varying(40) NOT NULL,
    issue_date date NOT NULL,
    tenant_id integer,
    landlord_name character varying(80) NOT NULL,
    data jsonb NOT NULL,
    pdf_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_commission_confirmations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_commission_confirmations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_commission_confirmations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_commission_confirmations_id_seq OWNED BY public.agent_commission_confirmations.id;


--
-- Name: agent_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_invoices (
    id integer NOT NULL,
    created_by_user_id integer NOT NULL,
    document_no character varying(40) NOT NULL,
    issue_date date NOT NULL,
    customer_name character varying(120) NOT NULL,
    data jsonb NOT NULL,
    pdf_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_slip_path text,
    receipt_document_no character varying(40),
    receipt_issue_date date,
    receipt_data jsonb,
    receipt_pdf_path text,
    tenant_id integer
);


--
-- Name: agent_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_invoices_id_seq OWNED BY public.agent_invoices.id;


--
-- Name: agreement_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_documents (
    id integer NOT NULL,
    agreement_id integer NOT NULL,
    document_type_code character varying(64) NOT NULL,
    subject character varying(32) NOT NULL,
    file_path text NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(64) NOT NULL,
    byte_size integer NOT NULL,
    uploaded_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    review_status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by_user_id integer,
    reviewed_at timestamp with time zone,
    review_note character varying(1000),
    supersedes_document_id integer,
    source_document_id integer,
    removed_at timestamp with time zone,
    CONSTRAINT agreement_documents_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 10485760))),
    CONSTRAINT agreement_documents_check CHECK (((((review_status)::text = 'pending'::text) AND (reviewed_by_user_id IS NULL) AND (reviewed_at IS NULL)) OR (((review_status)::text <> 'pending'::text) AND (reviewed_by_user_id IS NOT NULL) AND (reviewed_at IS NOT NULL)))),
    CONSTRAINT agreement_documents_mime_type_check CHECK (((mime_type)::text = ANY ((ARRAY['application/pdf'::character varying, 'image/jpeg'::character varying, 'image/png'::character varying])::text[]))),
    CONSTRAINT agreement_documents_review_status_check CHECK (((review_status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT agreement_documents_subject_check CHECK (((subject)::text = ANY ((ARRAY['tenant'::character varying, 'owner'::character varying, 'property'::character varying, 'representative'::character varying])::text[])))
);


--
-- Name: agreement_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agreement_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agreement_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agreement_documents_id_seq OWNED BY public.agreement_documents.id;


--
-- Name: agreement_sign_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_sign_invites (
    id integer NOT NULL,
    agreement_id integer NOT NULL,
    party character varying(16) NOT NULL,
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agreement_sign_invites_party_check CHECK (((party)::text = ANY ((ARRAY['owner'::character varying, 'tenant'::character varying])::text[])))
);


--
-- Name: agreement_sign_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agreement_sign_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agreement_sign_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agreement_sign_invites_id_seq OWNED BY public.agreement_sign_invites.id;


--
-- Name: agreement_template_document_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_template_document_requirements (
    id integer NOT NULL,
    template_id integer NOT NULL,
    group_key character varying(64) NOT NULL,
    label character varying(255) NOT NULL,
    subject character varying(32) NOT NULL,
    document_type_code character varying(64) NOT NULL,
    CONSTRAINT agreement_template_document_requirements_subject_check CHECK (((subject)::text = ANY ((ARRAY['tenant'::character varying, 'owner'::character varying, 'property'::character varying, 'representative'::character varying])::text[])))
);


--
-- Name: agreement_template_document_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agreement_template_document_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agreement_template_document_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agreement_template_document_requirements_id_seq OWNED BY public.agreement_template_document_requirements.id;


--
-- Name: agreement_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_templates (
    id integer NOT NULL,
    agreement_type_code character varying(64) NOT NULL,
    version integer NOT NULL,
    name character varying(255) NOT NULL,
    form_kind character varying(32) NOT NULL,
    data_schema jsonb NOT NULL,
    document_template_key text,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT agreement_templates_data_schema_check CHECK ((jsonb_typeof(data_schema) = 'object'::text)),
    CONSTRAINT agreement_templates_form_kind_check CHECK (((form_kind)::text = ANY ((ARRAY['reservation'::character varying, 'lease'::character varying, 'broker_appointment'::character varying, 'renewal'::character varying])::text[]))),
    CONSTRAINT agreement_templates_version_check CHECK ((version > 0))
);


--
-- Name: agreement_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agreement_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agreement_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agreement_templates_id_seq OWNED BY public.agreement_templates.id;


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    note character varying(500),
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    line_id character varying(100),
    facebook character varying(255)
);


--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: contract_deposit_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_deposit_settlements (
    id integer NOT NULL,
    lease_contract_id integer NOT NULL,
    deposit_received_amount numeric(12,2) DEFAULT 0 NOT NULL,
    deposit_received_reference text,
    available_deposit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    deduction_total numeric(12,2) DEFAULT 0 NOT NULL,
    carried_forward_total numeric(12,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    decision_note text,
    created_by_user_id integer NOT NULL,
    approved_by_user_id integer,
    approved_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_deposit_completion CHECK ((((status)::text <> 'completed'::text) OR (refund_amount = (0)::numeric) OR (refunded_at IS NOT NULL))),
    CONSTRAINT chk_deposit_refund_proof CHECK (((refunded_at IS NULL) OR (((status)::text <> 'draft'::text) AND (refund_amount > (0)::numeric) AND (NULLIF(btrim(refund_reference), ''::text) IS NOT NULL)))),
    CONSTRAINT chk_deposit_settlement_approval CHECK ((((status)::text = 'draft'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL) AND (NULLIF(btrim(decision_note), ''::text) IS NOT NULL)))),
    CONSTRAINT chk_deposit_settlement_balance CHECK ((((status)::text = 'draft'::text) OR (available_deposit_amount = ((deduction_total + carried_forward_total) + refund_amount)))),
    CONSTRAINT contract_deposit_settlements_available_deposit_amount_check CHECK (((available_deposit_amount >= (0)::numeric) AND (available_deposit_amount <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_settlements_carried_forward_total_check CHECK (((carried_forward_total >= (0)::numeric) AND (carried_forward_total <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_settlements_deduction_total_check CHECK (((deduction_total >= (0)::numeric) AND (deduction_total <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_settlements_deposit_received_amount_check CHECK (((deposit_received_amount >= (0)::numeric) AND (deposit_received_amount <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_settlements_refund_amount_check CHECK (((refund_amount >= (0)::numeric) AND (refund_amount <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_settlements_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'approved'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: contract_deposit_settlements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_deposit_settlements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_deposit_settlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_deposit_settlements_id_seq OWNED BY public.contract_deposit_settlements.id;


--
-- Name: contract_deposit_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_deposit_transfers (
    id integer NOT NULL,
    from_contract_id integer NOT NULL,
    to_contract_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    created_by_user_id integer NOT NULL,
    approved_by_user_id integer,
    approved_at timestamp with time zone,
    transferred_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_deposit_transfer_completion CHECK (((((status)::text = 'completed'::text) AND (approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL) AND (transferred_at IS NOT NULL)) OR (((status)::text <> 'completed'::text) AND (transferred_at IS NULL)))),
    CONSTRAINT chk_deposit_transfer_distinct CHECK ((from_contract_id <> to_contract_id)),
    CONSTRAINT contract_deposit_transfers_amount_check CHECK (((amount > (0)::numeric) AND (amount <> 'NaN'::numeric))),
    CONSTRAINT contract_deposit_transfers_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: contract_deposit_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_deposit_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_deposit_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_deposit_transfers_id_seq OWNED BY public.contract_deposit_transfers.id;


--
-- Name: deposit_deduction_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposit_deduction_items (
    id integer NOT NULL,
    settlement_id integer NOT NULL,
    deduction_type character varying(32) NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    evidence_reference text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deposit_deduction_items_amount_check CHECK (((amount > (0)::numeric) AND (amount <> 'NaN'::numeric))),
    CONSTRAINT deposit_deduction_items_deduction_type_check CHECK (((deduction_type)::text = ANY ((ARRAY['rent'::character varying, 'utilities'::character varying, 'damage'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT deposit_deduction_items_description_check CHECK ((btrim(description) <> ''::text)),
    CONSTRAINT deposit_deduction_items_evidence_reference_check CHECK ((btrim(evidence_reference) <> ''::text))
);


--
-- Name: deposit_deduction_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deposit_deduction_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deposit_deduction_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deposit_deduction_items_id_seq OWNED BY public.deposit_deduction_items.id;


--
-- Name: lead_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_locations (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    rank smallint NOT NULL,
    place_id character varying(255),
    name character varying(500) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    province character varying(120) NOT NULL,
    district character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_lead_locations_lat CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT chk_lead_locations_lng CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
    CONSTRAINT chk_lead_locations_rank CHECK (((rank >= 1) AND (rank <= 3)))
);


--
-- Name: lead_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_locations_id_seq OWNED BY public.lead_locations.id;


--
-- Name: lead_match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_match_results (
    id integer NOT NULL,
    run_id integer NOT NULL,
    rent_room_id integer NOT NULL,
    rank smallint NOT NULL,
    score smallint,
    location_score smallint NOT NULL,
    price numeric(12,2) NOT NULL,
    term_months smallint,
    distance_km double precision NOT NULL,
    pin_rank smallint NOT NULL,
    comparison jsonb NOT NULL,
    CONSTRAINT chk_lead_match_results_location CHECK (((location_score >= 0) AND (location_score <= 100))),
    CONSTRAINT chk_lead_match_results_score CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100))))
);


--
-- Name: lead_match_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_match_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_match_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_match_results_id_seq OWNED BY public.lead_match_results.id;


--
-- Name: lead_match_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_match_runs (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    run_by_user_id integer NOT NULL,
    settings jsonb NOT NULL,
    input_hash character varying(64) NOT NULL,
    scoring_version smallint NOT NULL,
    candidate_count integer NOT NULL,
    result_count integer NOT NULL,
    top_score smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_lead_match_runs_counts CHECK (((candidate_count >= 0) AND (result_count >= 0) AND (result_count <= candidate_count))),
    CONSTRAINT chk_lead_match_runs_top_score CHECK (((top_score IS NULL) OR ((top_score >= 0) AND (top_score <= 100))))
);


--
-- Name: lead_match_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_match_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_match_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_match_runs_id_seq OWNED BY public.lead_match_runs.id;


--
-- Name: lead_viewings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_viewings (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    rent_room_id integer NOT NULL,
    created_by_user_id integer NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    note character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_lead_viewings_status CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: lead_viewings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_viewings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_viewings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_viewings_id_seq OWNED BY public.lead_viewings.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    rent_room_id integer,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    source character varying(64),
    desired_room_type_id integer,
    budget_min numeric(12,2),
    budget_max numeric(12,2),
    other_contacts jsonb DEFAULT '[]'::jsonb NOT NULL,
    nationality character varying(120),
    location_place_id character varying(255),
    location_name character varying(500),
    latitude double precision,
    longitude double precision,
    radius_km smallint,
    province character varying(120),
    locations text[] DEFAULT '{}'::text[] NOT NULL,
    preferred_location character varying(500),
    move_in_plan character varying(255),
    has_pets boolean,
    occupation character varying(255),
    visa_type_id integer,
    lease_duration_months smallint,
    uses_car boolean,
    occupant_count smallint,
    is_smoker boolean,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    viewed_at timestamp with time zone,
    lost_reason character varying(500),
    notes text,
    tenant_id integer,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name character varying(255) DEFAULT ''::character varying NOT NULL,
    last_name character varying(255) DEFAULT ''::character varying NOT NULL,
    match_settings jsonb,
    CONSTRAINT chk_leads_budget CHECK ((((budget_min IS NULL) OR ((budget_min >= (0)::numeric) AND (budget_min <> 'NaN'::numeric))) AND ((budget_max IS NULL) OR ((budget_max > (0)::numeric) AND (budget_max <> 'NaN'::numeric))) AND ((budget_min IS NULL) OR (budget_max IS NULL) OR (budget_min <= budget_max)))),
    CONSTRAINT chk_leads_lease_duration CHECK (((lease_duration_months IS NULL) OR (lease_duration_months > 0))),
    CONSTRAINT chk_leads_occupant_count CHECK (((occupant_count IS NULL) OR (occupant_count > 0))),
    CONSTRAINT chk_leads_other_contacts_array CHECK ((jsonb_typeof(other_contacts) = 'array'::text)),
    CONSTRAINT chk_leads_radius_km CHECK (((radius_km IS NULL) OR (radius_km = ANY (ARRAY[1, 3, 5])))),
    CONSTRAINT chk_leads_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'inprogress'::character varying, 'lost'::character varying, 'booked'::character varying])::text[])))
);


--
-- Name: COLUMN leads.desired_room_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.desired_room_type_id IS 'Desired room type; independent of a selected rental room';


--
-- Name: COLUMN leads.budget_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.budget_min IS 'Minimum monthly rent budget, THB';


--
-- Name: COLUMN leads.budget_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.budget_max IS 'Maximum monthly rent budget, THB';


--
-- Name: COLUMN leads.other_contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.other_contacts IS 'Array of {channel, value}, e.g. line, whatsapp, facebook';


--
-- Name: COLUMN leads.radius_km; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.radius_km IS 'Requested straight-line radius in km around the map pin';


--
-- Name: COLUMN leads.province; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.province IS 'Canonical Thai province; NULL for legacy leads';


--
-- Name: COLUMN leads.preferred_location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.preferred_location IS 'Additional location details; legacy free-text location preserved';


--
-- Name: COLUMN leads.move_in_plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.move_in_plan IS 'Free-text move-in plan, e.g. immediately, October 2026, or an exact date';


--
-- Name: COLUMN leads.has_pets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.has_pets IS 'NULL = unknown; true = pets; false = no pets';


--
-- Name: COLUMN leads.visa_type_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.visa_type_id IS 'Optional FK to master_visa_types; NULL when unknown or not a foreign national';


--
-- Name: COLUMN leads.lease_duration_months; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.lease_duration_months IS 'Requested rental duration in whole months';


--
-- Name: COLUMN leads.uses_car; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.uses_car IS 'NULL = unknown; true = uses a car; false = no car';


--
-- Name: COLUMN leads.is_smoker; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.leads.is_smoker IS 'NULL = unknown; true = smoker; false = non-smoker';


--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: lease_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lease_contracts (
    id integer NOT NULL,
    contract_no character varying(32),
    room_tenancy_id integer NOT NULL,
    rent_room_id integer NOT NULL,
    tenant_id integer NOT NULL,
    lead_id integer NOT NULL,
    property_owner_id integer,
    owner_user_id integer,
    created_by_user_id integer NOT NULL,
    original_contract_id integer,
    contract_type_code character varying(64),
    start_date date NOT NULL,
    end_date date,
    monthly_rent numeric(12,2),
    deposit numeric(12,2),
    advance_rent numeric(12,2),
    status character varying(40) DEFAULT 'draft'::character varying NOT NULL,
    document_url text,
    owner_signed_at timestamp with time zone,
    tenant_signed_at timestamp with time zone,
    reviewed_by_user_id integer,
    reviewed_at timestamp with time zone,
    payment_submitted_at timestamp with time zone,
    terminated_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_delivered_at timestamp with time zone,
    tenant_delivered_at timestamp with time zone,
    agreement_type_code character varying(64) DEFAULT 'lease'::character varying NOT NULL,
    reservation_fee numeric(12,2),
    agent_signed_at timestamp with time zone,
    owner_signature_url text,
    tenant_signature_url text,
    agent_signature_url text,
    invoice_url text,
    receipt_url text,
    move_in_date date,
    template_id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    party_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    agreement_kind character varying(16) DEFAULT 'new'::character varying NOT NULL,
    previous_agreement_id integer,
    root_agreement_id integer,
    end_reason_id integer,
    end_reason_note text,
    effective_end_date date,
    end_recorded_at timestamp with time zone,
    end_recorded_by_user_id integer,
    CONSTRAINT chk_agreement_data CHECK (((jsonb_typeof(data) = 'object'::text) AND (jsonb_typeof(party_snapshot) = 'object'::text))),
    CONSTRAINT chk_agreement_lineage CHECK (((((agreement_kind)::text = 'new'::text) AND (previous_agreement_id IS NULL)) OR (((agreement_kind)::text = 'renewal'::text) AND (previous_agreement_id IS NOT NULL) AND (root_agreement_id IS NOT NULL) AND (previous_agreement_id <> id) AND (root_agreement_id <> id)))),
    CONSTRAINT chk_lease_contracts_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'awaiting_signatures'::character varying, 'awaiting_agent_review'::character varying, 'awaiting_payment'::character varying, 'awaiting_payment_verification'::character varying, 'active'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'terminated'::character varying])::text[]))),
    CONSTRAINT chk_reservation_fee_nonnegative CHECK ((reservation_fee >= (0)::numeric))
);


--
-- Name: lease_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lease_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lease_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lease_contracts_id_seq OWNED BY public.lease_contracts.id;


--
-- Name: master_agreement_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_agreement_types (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    name_th character varying(255) NOT NULL,
    name_en character varying(255) NOT NULL,
    icon character varying(64) DEFAULT 'note'::character varying NOT NULL,
    form_kind character varying(32) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_agreement_form_kind CHECK (((form_kind)::text = ANY ((ARRAY['reservation'::character varying, 'lease'::character varying, 'broker_appointment'::character varying, 'renewal'::character varying])::text[])))
);


--
-- Name: master_agreement_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_agreement_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_agreement_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_agreement_types_id_seq OWNED BY public.master_agreement_types.id;


--
-- Name: master_contract_end_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_contract_end_reasons (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    name_th character varying(255) NOT NULL,
    name_en character varying(255) NOT NULL,
    applicable_status character varying(40) NOT NULL,
    default_deposit_policy character varying(32) DEFAULT 'manual_review'::character varying NOT NULL,
    requires_note boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT master_contract_end_reasons_applicable_status_check CHECK (((applicable_status)::text = ANY ((ARRAY['expired'::character varying, 'terminated'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT master_contract_end_reasons_default_deposit_policy_check CHECK (((default_deposit_policy)::text = ANY ((ARRAY['refund_full'::character varying, 'refund_after_deductions'::character varying, 'manual_review'::character varying])::text[])))
);


--
-- Name: master_contract_end_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_contract_end_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_contract_end_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_contract_end_reasons_id_seq OWNED BY public.master_contract_end_reasons.id;


--
-- Name: master_contract_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_contract_types (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    term_months smallint NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: master_contract_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_contract_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_contract_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_contract_types_id_seq OWNED BY public.master_contract_types.id;


--
-- Name: master_document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_document_types (
    code character varying(64) NOT NULL,
    name_th character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: master_facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_facilities (
    id integer NOT NULL,
    group_id integer NOT NULL,
    code character varying(64) NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_extra_charge boolean DEFAULT false NOT NULL
);


--
-- Name: master_facilities_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_facilities_groups (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


--
-- Name: master_facilities_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_facilities_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_facilities_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_facilities_groups_id_seq OWNED BY public.master_facilities_groups.id;


--
-- Name: master_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_facilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_facilities_id_seq OWNED BY public.master_facilities.id;


--
-- Name: master_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_layouts (
    id integer NOT NULL,
    code character varying(64) NOT NULL
);


--
-- Name: master_layouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_layouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_layouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_layouts_id_seq OWNED BY public.master_layouts.id;


--
-- Name: master_listing_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_listing_sources (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: master_listing_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_listing_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_listing_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_listing_sources_id_seq OWNED BY public.master_listing_sources.id;


--
-- Name: master_property_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_property_types (
    id integer NOT NULL,
    code character varying(64) NOT NULL
);


--
-- Name: master_property_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_property_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_property_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_property_types_id_seq OWNED BY public.master_property_types.id;


--
-- Name: master_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    details character varying(255)
);


--
-- Name: master_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_roles_id_seq OWNED BY public.master_roles.id;


--
-- Name: master_room_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_room_statuses (
    id integer NOT NULL,
    code character varying(32) NOT NULL
);


--
-- Name: master_room_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_room_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_room_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_room_statuses_id_seq OWNED BY public.master_room_statuses.id;


--
-- Name: master_room_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_room_types (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    bedroom_count smallint,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: master_room_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_room_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_room_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_room_types_id_seq OWNED BY public.master_room_types.id;


--
-- Name: master_visa_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_visa_types (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE master_visa_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.master_visa_types IS 'Visa types for foreign room-seekers; display via i18n masters.visaTypes.<code>';


--
-- Name: master_visa_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_visa_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_visa_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_visa_types_id_seq OWNED BY public.master_visa_types.id;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    property_type_id integer,
    address text NOT NULL,
    subdistrict character varying(255) DEFAULT '-'::character varying NOT NULL,
    district character varying(255) NOT NULL,
    province character varying(255) NOT NULL,
    postal_code character varying(10) DEFAULT '-'::character varying NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.properties_id_seq OWNED BY public.properties.id;


--
-- Name: property_owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_owners (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    note character varying(500),
    created_by_user_id integer NOT NULL,
    user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_owners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.property_owners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: property_owners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.property_owners_id_seq OWNED BY public.property_owners.id;


--
-- Name: rent_room_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rent_room_contacts (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    contact_id integer NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    role_code character varying(64) DEFAULT 'contact'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rent_room_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rent_room_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rent_room_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rent_room_contacts_id_seq OWNED BY public.rent_room_contacts.id;


--
-- Name: rent_room_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rent_room_documents (
    id integer NOT NULL,
    rent_id integer NOT NULL,
    kind character varying(32) NOT NULL,
    media_url character varying(500) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rent_room_documents_kind CHECK (((kind)::text = ANY ((ARRAY['id_passport'::character varying, 'bookbank'::character varying, 'ownership'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: rent_room_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rent_room_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rent_room_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rent_room_documents_id_seq OWNED BY public.rent_room_documents.id;


--
-- Name: rent_room_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rent_room_prices (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    contract_type_id integer NOT NULL,
    price numeric(12,2) NOT NULL
);


--
-- Name: rent_room_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rent_room_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rent_room_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rent_room_prices_id_seq OWNED BY public.rent_room_prices.id;


--
-- Name: rent_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rent_rooms (
    id integer NOT NULL,
    room_id character varying(100),
    listing_title character varying(255),
    listing_description text,
    available_from_date date DEFAULT CURRENT_DATE NOT NULL,
    prices jsonb,
    custom_facilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    nearby_other character varying(500),
    nearby_places jsonb DEFAULT '[]'::jsonb NOT NULL,
    water_rate_per_unit numeric(12,2),
    electric_rate_per_unit numeric(12,2),
    advance_rent_months smallint DEFAULT 1 NOT NULL,
    deposit_months smallint DEFAULT 2 NOT NULL,
    owner_identity_number character varying(100),
    owner_bank_name character varying(120),
    owner_bank_account character varying(30),
    is_scout_room boolean DEFAULT false NOT NULL,
    visibility character varying(20),
    created_by_user_id integer,
    property_owner_id integer,
    owner_id integer,
    properties_id integer NOT NULL,
    room_type_id integer,
    listing_source_id integer,
    room_status_id integer NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    promo_title character varying(255),
    CONSTRAINT chk_rent_rooms_advance_rent_months CHECK (((advance_rent_months >= 0) AND (advance_rent_months <= 12))),
    CONSTRAINT chk_rent_rooms_deposit_months CHECK (((deposit_months >= 0) AND (deposit_months <= 12))),
    CONSTRAINT chk_rent_rooms_owner_invariant CHECK ((is_scout_room OR ((owner_id IS NOT NULL) AND (property_owner_id IS NULL) AND (visibility IS NULL)))),
    CONSTRAINT chk_rent_rooms_scout_invariant CHECK (((NOT is_scout_room) OR ((created_by_user_id IS NOT NULL) AND (owner_id IS NULL) AND ((visibility)::text = ANY ((ARRAY['private'::character varying, 'published'::character varying])::text[]))))),
    CONSTRAINT chk_rent_rooms_visibility CHECK (((visibility IS NULL) OR ((visibility)::text = ANY ((ARRAY['private'::character varying, 'published'::character varying])::text[]))))
);


--
-- Name: COLUMN rent_rooms.listing_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rent_rooms.listing_title IS 'Agent-only internal listing name';


--
-- Name: COLUMN rent_rooms.promo_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rent_rooms.promo_title IS 'Public listing headline for share / marketplace';


--
-- Name: rent_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rent_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rent_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rent_rooms_id_seq OWNED BY public.rent_rooms.id;


--
-- Name: room_facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_facilities (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    group_id integer NOT NULL,
    f_id integer NOT NULL
);


--
-- Name: room_facilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_facilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_facilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_facilities_id_seq OWNED BY public.room_facilities.id;


--
-- Name: room_layout_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_layout_values (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    layout_id integer NOT NULL,
    value character varying(64) NOT NULL
);


--
-- Name: room_layout_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_layout_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_layout_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_layout_values_id_seq OWNED BY public.room_layout_values.id;


--
-- Name: room_medias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_medias (
    id integer NOT NULL,
    rent_id integer NOT NULL,
    media_url character varying(500) NOT NULL,
    media_type character varying(16) DEFAULT 'image'::character varying NOT NULL,
    category character varying(32) DEFAULT 'room'::character varying NOT NULL,
    is_cover boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_room_medias_category CHECK (((category)::text = ANY ((ARRAY['room'::character varying, 'common'::character varying, 'floorplan'::character varying])::text[]))),
    CONSTRAINT chk_room_medias_type CHECK (((media_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying])::text[])))
);


--
-- Name: room_medias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_medias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_medias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_medias_id_seq OWNED BY public.room_medias.id;


--
-- Name: room_share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_share_links (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    created_by_user_id integer NOT NULL,
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    share_sections jsonb NOT NULL,
    contact_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_share_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_share_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_share_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_share_links_id_seq OWNED BY public.room_share_links.id;


--
-- Name: room_tenancies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_tenancies (
    id integer NOT NULL,
    rent_room_id integer NOT NULL,
    tenant_id integer NOT NULL,
    status character varying(20) DEFAULT 'prospect'::character varying NOT NULL,
    move_in_date date,
    move_out_date date,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_room_tenancies_status CHECK (((status)::text = ANY ((ARRAY['prospect'::character varying, 'active'::character varying, 'moved_out'::character varying])::text[])))
);


--
-- Name: room_tenancies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_tenancies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_tenancies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_tenancies_id_seq OWNED BY public.room_tenancies.id;


--
-- Name: tenant_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_bills (
    id integer NOT NULL,
    lease_contract_id integer NOT NULL,
    tenant_id integer NOT NULL,
    period character varying(7) NOT NULL,
    document_no character varying(40) NOT NULL,
    issue_date date NOT NULL,
    due_date date NOT NULL,
    grace_until date NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    payment_slip_path text,
    invoice_path text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slip_submitted_at timestamp with time zone,
    slip_return_note text,
    CONSTRAINT chk_tenant_bills_period_format CHECK (((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
    CONSTRAINT chk_tenant_bills_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying])::text[])))
);


--
-- Name: tenant_bills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_bills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_bills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_bills_id_seq OWNED BY public.tenant_bills.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    email character varying(255),
    note character varying(500),
    user_id integer,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_number character varying(100),
    nationality character varying(120),
    first_name character varying(255) DEFAULT ''::character varying NOT NULL,
    last_name character varying(255) DEFAULT ''::character varying NOT NULL
);


--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    supabase_user_id uuid,
    email character varying(255) NOT NULL,
    password character varying(255),
    first_name character varying(255) DEFAULT 'User'::character varying NOT NULL,
    last_name character varying(255) DEFAULT ''::character varying NOT NULL,
    phone character varying(50),
    avatar_url character varying(512),
    profile_completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_number character varying(100),
    nationality character varying(120)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: agent_commission_confirmations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commission_confirmations ALTER COLUMN id SET DEFAULT nextval('public.agent_commission_confirmations_id_seq'::regclass);


--
-- Name: agent_invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_invoices ALTER COLUMN id SET DEFAULT nextval('public.agent_invoices_id_seq'::regclass);


--
-- Name: agreement_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents ALTER COLUMN id SET DEFAULT nextval('public.agreement_documents_id_seq'::regclass);


--
-- Name: agreement_sign_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_sign_invites ALTER COLUMN id SET DEFAULT nextval('public.agreement_sign_invites_id_seq'::regclass);


--
-- Name: agreement_template_document_requirements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_template_document_requirements ALTER COLUMN id SET DEFAULT nextval('public.agreement_template_document_requirements_id_seq'::regclass);


--
-- Name: agreement_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_templates ALTER COLUMN id SET DEFAULT nextval('public.agreement_templates_id_seq'::regclass);


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: contract_deposit_settlements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements ALTER COLUMN id SET DEFAULT nextval('public.contract_deposit_settlements_id_seq'::regclass);


--
-- Name: contract_deposit_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers ALTER COLUMN id SET DEFAULT nextval('public.contract_deposit_transfers_id_seq'::regclass);


--
-- Name: deposit_deduction_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_deduction_items ALTER COLUMN id SET DEFAULT nextval('public.deposit_deduction_items_id_seq'::regclass);


--
-- Name: lead_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_locations ALTER COLUMN id SET DEFAULT nextval('public.lead_locations_id_seq'::regclass);


--
-- Name: lead_match_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results ALTER COLUMN id SET DEFAULT nextval('public.lead_match_results_id_seq'::regclass);


--
-- Name: lead_match_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_runs ALTER COLUMN id SET DEFAULT nextval('public.lead_match_runs_id_seq'::regclass);


--
-- Name: lead_viewings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_viewings ALTER COLUMN id SET DEFAULT nextval('public.lead_viewings_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: lease_contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts ALTER COLUMN id SET DEFAULT nextval('public.lease_contracts_id_seq'::regclass);


--
-- Name: master_agreement_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_agreement_types ALTER COLUMN id SET DEFAULT nextval('public.master_agreement_types_id_seq'::regclass);


--
-- Name: master_contract_end_reasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_end_reasons ALTER COLUMN id SET DEFAULT nextval('public.master_contract_end_reasons_id_seq'::regclass);


--
-- Name: master_contract_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_types ALTER COLUMN id SET DEFAULT nextval('public.master_contract_types_id_seq'::regclass);


--
-- Name: master_facilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities ALTER COLUMN id SET DEFAULT nextval('public.master_facilities_id_seq'::regclass);


--
-- Name: master_facilities_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities_groups ALTER COLUMN id SET DEFAULT nextval('public.master_facilities_groups_id_seq'::regclass);


--
-- Name: master_layouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_layouts ALTER COLUMN id SET DEFAULT nextval('public.master_layouts_id_seq'::regclass);


--
-- Name: master_listing_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_listing_sources ALTER COLUMN id SET DEFAULT nextval('public.master_listing_sources_id_seq'::regclass);


--
-- Name: master_property_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_property_types ALTER COLUMN id SET DEFAULT nextval('public.master_property_types_id_seq'::regclass);


--
-- Name: master_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_roles ALTER COLUMN id SET DEFAULT nextval('public.master_roles_id_seq'::regclass);


--
-- Name: master_room_statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_statuses ALTER COLUMN id SET DEFAULT nextval('public.master_room_statuses_id_seq'::regclass);


--
-- Name: master_room_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_types ALTER COLUMN id SET DEFAULT nextval('public.master_room_types_id_seq'::regclass);


--
-- Name: master_visa_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_visa_types ALTER COLUMN id SET DEFAULT nextval('public.master_visa_types_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);


--
-- Name: property_owners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_owners ALTER COLUMN id SET DEFAULT nextval('public.property_owners_id_seq'::regclass);


--
-- Name: rent_room_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_contacts ALTER COLUMN id SET DEFAULT nextval('public.rent_room_contacts_id_seq'::regclass);


--
-- Name: rent_room_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_documents ALTER COLUMN id SET DEFAULT nextval('public.rent_room_documents_id_seq'::regclass);


--
-- Name: rent_room_prices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_prices ALTER COLUMN id SET DEFAULT nextval('public.rent_room_prices_id_seq'::regclass);


--
-- Name: rent_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms ALTER COLUMN id SET DEFAULT nextval('public.rent_rooms_id_seq'::regclass);


--
-- Name: room_facilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities ALTER COLUMN id SET DEFAULT nextval('public.room_facilities_id_seq'::regclass);


--
-- Name: room_layout_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_layout_values ALTER COLUMN id SET DEFAULT nextval('public.room_layout_values_id_seq'::regclass);


--
-- Name: room_medias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_medias ALTER COLUMN id SET DEFAULT nextval('public.room_medias_id_seq'::regclass);


--
-- Name: room_share_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links ALTER COLUMN id SET DEFAULT nextval('public.room_share_links_id_seq'::regclass);


--
-- Name: room_tenancies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_tenancies ALTER COLUMN id SET DEFAULT nextval('public.room_tenancies_id_seq'::regclass);


--
-- Name: tenant_bills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills ALTER COLUMN id SET DEFAULT nextval('public.tenant_bills_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: agent_commission_confirmations agent_commission_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commission_confirmations
    ADD CONSTRAINT agent_commission_confirmations_pkey PRIMARY KEY (id);


--
-- Name: agent_invoices agent_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_invoices
    ADD CONSTRAINT agent_invoices_pkey PRIMARY KEY (id);


--
-- Name: agreement_documents agreement_documents_file_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_file_path_key UNIQUE (file_path);


--
-- Name: agreement_documents agreement_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_pkey PRIMARY KEY (id);


--
-- Name: agreement_documents agreement_documents_supersedes_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_supersedes_document_id_key UNIQUE (supersedes_document_id);


--
-- Name: agreement_sign_invites agreement_sign_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_sign_invites
    ADD CONSTRAINT agreement_sign_invites_pkey PRIMARY KEY (id);


--
-- Name: agreement_template_document_requirements agreement_template_document_r_template_id_group_key_documen_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_template_document_requirements
    ADD CONSTRAINT agreement_template_document_r_template_id_group_key_documen_key UNIQUE (template_id, group_key, document_type_code);


--
-- Name: agreement_template_document_requirements agreement_template_document_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_template_document_requirements
    ADD CONSTRAINT agreement_template_document_requirements_pkey PRIMARY KEY (id);


--
-- Name: agreement_templates agreement_templates_agreement_type_code_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_templates
    ADD CONSTRAINT agreement_templates_agreement_type_code_version_key UNIQUE (agreement_type_code, version);


--
-- Name: agreement_templates agreement_templates_id_agreement_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_templates
    ADD CONSTRAINT agreement_templates_id_agreement_type_code_key UNIQUE (id, agreement_type_code);


--
-- Name: agreement_templates agreement_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_templates
    ADD CONSTRAINT agreement_templates_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contract_deposit_settlements contract_deposit_settlements_lease_contract_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements
    ADD CONSTRAINT contract_deposit_settlements_lease_contract_id_key UNIQUE (lease_contract_id);


--
-- Name: contract_deposit_settlements contract_deposit_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements
    ADD CONSTRAINT contract_deposit_settlements_pkey PRIMARY KEY (id);


--
-- Name: contract_deposit_transfers contract_deposit_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers
    ADD CONSTRAINT contract_deposit_transfers_pkey PRIMARY KEY (id);


--
-- Name: deposit_deduction_items deposit_deduction_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_deduction_items
    ADD CONSTRAINT deposit_deduction_items_pkey PRIMARY KEY (id);


--
-- Name: lead_locations lead_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_locations
    ADD CONSTRAINT lead_locations_pkey PRIMARY KEY (id);


--
-- Name: lead_match_results lead_match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results
    ADD CONSTRAINT lead_match_results_pkey PRIMARY KEY (id);


--
-- Name: lead_match_runs lead_match_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_runs
    ADD CONSTRAINT lead_match_runs_pkey PRIMARY KEY (id);


--
-- Name: lead_viewings lead_viewings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_viewings
    ADD CONSTRAINT lead_viewings_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: lease_contracts lease_contracts_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_contract_no_key UNIQUE (contract_no);


--
-- Name: lease_contracts lease_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_pkey PRIMARY KEY (id);


--
-- Name: master_agreement_types master_agreement_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_agreement_types
    ADD CONSTRAINT master_agreement_types_code_key UNIQUE (code);


--
-- Name: master_agreement_types master_agreement_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_agreement_types
    ADD CONSTRAINT master_agreement_types_pkey PRIMARY KEY (id);


--
-- Name: master_contract_end_reasons master_contract_end_reasons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_end_reasons
    ADD CONSTRAINT master_contract_end_reasons_code_key UNIQUE (code);


--
-- Name: master_contract_end_reasons master_contract_end_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_end_reasons
    ADD CONSTRAINT master_contract_end_reasons_pkey PRIMARY KEY (id);


--
-- Name: master_contract_types master_contract_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_types
    ADD CONSTRAINT master_contract_types_code_key UNIQUE (code);


--
-- Name: master_contract_types master_contract_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_contract_types
    ADD CONSTRAINT master_contract_types_pkey PRIMARY KEY (id);


--
-- Name: master_document_types master_document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_document_types
    ADD CONSTRAINT master_document_types_pkey PRIMARY KEY (code);


--
-- Name: master_facilities master_facilities_group_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities
    ADD CONSTRAINT master_facilities_group_id_code_key UNIQUE (group_id, code);


--
-- Name: master_facilities_groups master_facilities_groups_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities_groups
    ADD CONSTRAINT master_facilities_groups_code_key UNIQUE (code);


--
-- Name: master_facilities_groups master_facilities_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities_groups
    ADD CONSTRAINT master_facilities_groups_pkey PRIMARY KEY (id);


--
-- Name: master_facilities master_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities
    ADD CONSTRAINT master_facilities_pkey PRIMARY KEY (id);


--
-- Name: master_layouts master_layouts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_layouts
    ADD CONSTRAINT master_layouts_code_key UNIQUE (code);


--
-- Name: master_layouts master_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_layouts
    ADD CONSTRAINT master_layouts_pkey PRIMARY KEY (id);


--
-- Name: master_listing_sources master_listing_sources_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_listing_sources
    ADD CONSTRAINT master_listing_sources_code_key UNIQUE (code);


--
-- Name: master_listing_sources master_listing_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_listing_sources
    ADD CONSTRAINT master_listing_sources_pkey PRIMARY KEY (id);


--
-- Name: master_property_types master_property_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_property_types
    ADD CONSTRAINT master_property_types_code_key UNIQUE (code);


--
-- Name: master_property_types master_property_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_property_types
    ADD CONSTRAINT master_property_types_pkey PRIMARY KEY (id);


--
-- Name: master_roles master_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_roles
    ADD CONSTRAINT master_roles_name_key UNIQUE (name);


--
-- Name: master_roles master_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_roles
    ADD CONSTRAINT master_roles_pkey PRIMARY KEY (id);


--
-- Name: master_room_statuses master_room_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_statuses
    ADD CONSTRAINT master_room_statuses_code_key UNIQUE (code);


--
-- Name: master_room_statuses master_room_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_statuses
    ADD CONSTRAINT master_room_statuses_pkey PRIMARY KEY (id);


--
-- Name: master_room_types master_room_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_types
    ADD CONSTRAINT master_room_types_code_key UNIQUE (code);


--
-- Name: master_room_types master_room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_room_types
    ADD CONSTRAINT master_room_types_pkey PRIMARY KEY (id);


--
-- Name: master_visa_types master_visa_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_visa_types
    ADD CONSTRAINT master_visa_types_code_key UNIQUE (code);


--
-- Name: master_visa_types master_visa_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_visa_types
    ADD CONSTRAINT master_visa_types_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_owners property_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_owners
    ADD CONSTRAINT property_owners_pkey PRIMARY KEY (id);


--
-- Name: rent_room_contacts rent_room_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_contacts
    ADD CONSTRAINT rent_room_contacts_pkey PRIMARY KEY (id);


--
-- Name: rent_room_contacts rent_room_contacts_rent_room_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_contacts
    ADD CONSTRAINT rent_room_contacts_rent_room_id_contact_id_key UNIQUE (rent_room_id, contact_id);


--
-- Name: rent_room_documents rent_room_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_documents
    ADD CONSTRAINT rent_room_documents_pkey PRIMARY KEY (id);


--
-- Name: rent_room_prices rent_room_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_prices
    ADD CONSTRAINT rent_room_prices_pkey PRIMARY KEY (id);


--
-- Name: rent_room_prices rent_room_prices_rent_room_id_contract_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_prices
    ADD CONSTRAINT rent_room_prices_rent_room_id_contract_type_id_key UNIQUE (rent_room_id, contract_type_id);


--
-- Name: rent_rooms rent_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_pkey PRIMARY KEY (id);


--
-- Name: room_facilities room_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities
    ADD CONSTRAINT room_facilities_pkey PRIMARY KEY (id);


--
-- Name: room_facilities room_facilities_rent_room_id_f_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities
    ADD CONSTRAINT room_facilities_rent_room_id_f_id_key UNIQUE (rent_room_id, f_id);


--
-- Name: room_layout_values room_layout_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_layout_values
    ADD CONSTRAINT room_layout_values_pkey PRIMARY KEY (id);


--
-- Name: room_layout_values room_layout_values_rent_room_id_layout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_layout_values
    ADD CONSTRAINT room_layout_values_rent_room_id_layout_id_key UNIQUE (rent_room_id, layout_id);


--
-- Name: room_medias room_medias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_medias
    ADD CONSTRAINT room_medias_pkey PRIMARY KEY (id);


--
-- Name: room_share_links room_share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links
    ADD CONSTRAINT room_share_links_pkey PRIMARY KEY (id);


--
-- Name: room_tenancies room_tenancies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_tenancies
    ADD CONSTRAINT room_tenancies_pkey PRIMARY KEY (id);


--
-- Name: tenant_bills tenant_bills_document_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills
    ADD CONSTRAINT tenant_bills_document_no_key UNIQUE (document_no);


--
-- Name: tenant_bills tenant_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills
    ADD CONSTRAINT tenant_bills_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_lead_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_lead_id_key UNIQUE (lead_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: agent_commission_confirmations uq_agent_commission_confirmations_document; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commission_confirmations
    ADD CONSTRAINT uq_agent_commission_confirmations_document UNIQUE (created_by_user_id, document_no);


--
-- Name: agent_invoices uq_agent_invoices_document; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_invoices
    ADD CONSTRAINT uq_agent_invoices_document UNIQUE (created_by_user_id, document_no);


--
-- Name: agreement_sign_invites uq_agreement_sign_invites_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_sign_invites
    ADD CONSTRAINT uq_agreement_sign_invites_token_hash UNIQUE (token_hash);


--
-- Name: contacts uq_contacts_agent_phone; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT uq_contacts_agent_phone UNIQUE (created_by_user_id, phone);


--
-- Name: lead_locations uq_lead_locations_rank; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_locations
    ADD CONSTRAINT uq_lead_locations_rank UNIQUE (lead_id, rank);


--
-- Name: lead_match_results uq_lead_match_results_rank; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results
    ADD CONSTRAINT uq_lead_match_results_rank UNIQUE (run_id, rank);


--
-- Name: lead_match_results uq_lead_match_results_room; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results
    ADD CONSTRAINT uq_lead_match_results_room UNIQUE (run_id, rent_room_id);


--
-- Name: property_owners uq_property_owners_agent_phone; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_owners
    ADD CONSTRAINT uq_property_owners_agent_phone UNIQUE (created_by_user_id, phone);


--
-- Name: room_share_links uq_room_share_links_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links
    ADD CONSTRAINT uq_room_share_links_token_hash UNIQUE (token_hash);


--
-- Name: tenant_bills uq_tenant_bills_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills
    ADD CONSTRAINT uq_tenant_bills_period UNIQUE (lease_contract_id, period);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_supabase_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_supabase_user_id_key UNIQUE (supabase_user_id);


--
-- Name: idx_agent_commission_confirmations_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_commission_confirmations_agent ON public.agent_commission_confirmations USING btree (created_by_user_id, id DESC);


--
-- Name: idx_agent_invoices_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_invoices_agent ON public.agent_invoices USING btree (created_by_user_id, id DESC);


--
-- Name: idx_agent_invoices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_invoices_tenant ON public.agent_invoices USING btree (tenant_id, id DESC);


--
-- Name: idx_agreement_documents_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agreement_documents_contract ON public.agreement_documents USING btree (agreement_id);


--
-- Name: idx_agreement_one_renewal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_agreement_one_renewal ON public.lease_contracts USING btree (previous_agreement_id) WHERE ((previous_agreement_id IS NOT NULL) AND ((status)::text <> 'cancelled'::text));


--
-- Name: idx_agreement_root; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agreement_root ON public.lease_contracts USING btree (root_agreement_id);


--
-- Name: idx_agreement_sign_invites_agreement_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agreement_sign_invites_agreement_party ON public.agreement_sign_invites USING btree (agreement_id, party) WHERE ((used_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_contacts_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_created_by_user_id ON public.contacts USING btree (created_by_user_id);


--
-- Name: idx_contract_end_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_end_reason ON public.lease_contracts USING btree (end_reason_id);


--
-- Name: idx_deposit_deduction_settlement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_deduction_settlement ON public.deposit_deduction_items USING btree (settlement_id);


--
-- Name: idx_deposit_transfer_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_transfer_destination ON public.contract_deposit_transfers USING btree (to_contract_id);


--
-- Name: idx_lead_locations_lat_lng; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_locations_lat_lng ON public.lead_locations USING btree (latitude, longitude);


--
-- Name: idx_lead_match_runs_lead_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_match_runs_lead_created ON public.lead_match_runs USING btree (lead_id, created_at DESC);


--
-- Name: idx_lead_viewings_agent_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_viewings_agent_scheduled ON public.lead_viewings USING btree (created_by_user_id, scheduled_at);


--
-- Name: idx_lead_viewings_lead_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_viewings_lead_scheduled ON public.lead_viewings USING btree (lead_id, scheduled_at);


--
-- Name: idx_leads_agent_desired_room_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_agent_desired_room_type ON public.leads USING btree (created_by_user_id, desired_room_type_id);


--
-- Name: idx_leads_agent_province; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_agent_province ON public.leads USING btree (created_by_user_id, province);


--
-- Name: idx_leads_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_by_user_id ON public.leads USING btree (created_by_user_id);


--
-- Name: idx_leads_locations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_locations ON public.leads USING gin (locations);


--
-- Name: idx_leads_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_phone ON public.leads USING btree (phone);


--
-- Name: idx_leads_rent_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_rent_room_id ON public.leads USING btree (rent_room_id);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_lease_contracts_agreement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_agreement_type ON public.lease_contracts USING btree (agreement_type_code);


--
-- Name: idx_lease_contracts_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_created_by_user_id ON public.lease_contracts USING btree (created_by_user_id);


--
-- Name: idx_lease_contracts_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_lead_id ON public.lease_contracts USING btree (lead_id);


--
-- Name: idx_lease_contracts_original_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_original_contract_id ON public.lease_contracts USING btree (original_contract_id);


--
-- Name: idx_lease_contracts_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_owner_user_id ON public.lease_contracts USING btree (owner_user_id) WHERE (owner_user_id IS NOT NULL);


--
-- Name: idx_lease_contracts_rent_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_rent_room_id ON public.lease_contracts USING btree (rent_room_id);


--
-- Name: idx_lease_contracts_room_tenancy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_room_tenancy_id ON public.lease_contracts USING btree (room_tenancy_id);


--
-- Name: idx_lease_contracts_status_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_status_updated_at ON public.lease_contracts USING btree (status, updated_at DESC);


--
-- Name: idx_lease_contracts_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_contracts_tenant_id ON public.lease_contracts USING btree (tenant_id);


--
-- Name: idx_properties_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_name ON public.properties USING btree (name);


--
-- Name: idx_properties_property_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_property_type_id ON public.properties USING btree (property_type_id);


--
-- Name: idx_property_owners_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_owners_created_by_user_id ON public.property_owners USING btree (created_by_user_id);


--
-- Name: idx_rent_room_contacts_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_room_contacts_contact_id ON public.rent_room_contacts USING btree (contact_id);


--
-- Name: idx_rent_room_documents_rent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_room_documents_rent_id ON public.rent_room_documents USING btree (rent_id);


--
-- Name: idx_rent_room_prices_rent_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_room_prices_rent_room_id ON public.rent_room_prices USING btree (rent_room_id);


--
-- Name: idx_rent_rooms_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_created_by_user_id ON public.rent_rooms USING btree (created_by_user_id);


--
-- Name: idx_rent_rooms_is_scout_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_is_scout_room ON public.rent_rooms USING btree (is_scout_room);


--
-- Name: idx_rent_rooms_listing_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_listing_source_id ON public.rent_rooms USING btree (listing_source_id);


--
-- Name: idx_rent_rooms_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_owner_id ON public.rent_rooms USING btree (owner_id);


--
-- Name: idx_rent_rooms_properties_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_properties_id ON public.rent_rooms USING btree (properties_id);


--
-- Name: idx_rent_rooms_property_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_property_owner_id ON public.rent_rooms USING btree (property_owner_id);


--
-- Name: idx_rent_rooms_public_scout_listing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_public_scout_listing ON public.rent_rooms USING btree (visibility, room_status_id) WHERE ((is_scout_room = true) AND ((visibility)::text = 'published'::text));


--
-- Name: idx_rent_rooms_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rent_rooms_room_type_id ON public.rent_rooms USING btree (room_type_id);


--
-- Name: idx_room_medias_rent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_medias_rent_id ON public.room_medias USING btree (rent_id, sort_order);


--
-- Name: idx_room_share_links_rent_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_share_links_rent_room ON public.room_share_links USING btree (rent_room_id);


--
-- Name: idx_room_tenancies_rent_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_tenancies_rent_room_id ON public.room_tenancies USING btree (rent_room_id);


--
-- Name: idx_room_tenancies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_tenancies_status ON public.room_tenancies USING btree (status);


--
-- Name: idx_room_tenancies_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_tenancies_tenant_id ON public.room_tenancies USING btree (tenant_id);


--
-- Name: idx_tenant_bills_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_bills_tenant ON public.tenant_bills USING btree (tenant_id, due_date DESC);


--
-- Name: idx_tenants_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_created_by_user_id ON public.tenants USING btree (created_by_user_id);


--
-- Name: idx_tenants_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_lead_id ON public.tenants USING btree (lead_id);


--
-- Name: idx_tenants_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_phone ON public.tenants USING btree (phone);


--
-- Name: idx_tenants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_user_id ON public.tenants USING btree (user_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_supabase_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_supabase_user_id ON public.users USING btree (supabase_user_id);


--
-- Name: uq_agent_commission_confirmations_document_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_agent_commission_confirmations_document_no ON public.agent_commission_confirmations USING btree (document_no);


--
-- Name: uq_agent_invoices_document_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_agent_invoices_document_no ON public.agent_invoices USING btree (document_no);


--
-- Name: uq_agent_invoices_receipt_document_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_agent_invoices_receipt_document_no ON public.agent_invoices USING btree (receipt_document_no) WHERE (receipt_document_no IS NOT NULL);


--
-- Name: uq_agent_invoices_receipt_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_agent_invoices_receipt_no ON public.agent_invoices USING btree (created_by_user_id, receipt_document_no) WHERE (receipt_document_no IS NOT NULL);


--
-- Name: uq_deposit_transfer_live_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_deposit_transfer_live_source ON public.contract_deposit_transfers USING btree (from_contract_id) WHERE ((status)::text <> 'cancelled'::text);


--
-- Name: uq_leads_one_booked_per_room; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_leads_one_booked_per_room ON public.leads USING btree (rent_room_id) WHERE ((status)::text = 'booked'::text);


--
-- Name: uq_rent_room_contacts_one_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_rent_room_contacts_one_primary ON public.rent_room_contacts USING btree (rent_room_id) WHERE (is_primary = true);


--
-- Name: uq_room_medias_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_room_medias_one_cover ON public.room_medias USING btree (rent_id) WHERE (is_cover = true);


--
-- Name: uq_room_tenancies_one_active_per_room; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_room_tenancies_one_active_per_room ON public.room_tenancies USING btree (rent_room_id) WHERE ((status)::text = 'active'::text);


--
-- Name: agreement_documents agreement_document_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agreement_document_history BEFORE INSERT OR DELETE OR UPDATE ON public.agreement_documents FOR EACH ROW EXECUTE FUNCTION public.protect_agreement_document();


--
-- Name: lease_contracts agreement_document_signing_gate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agreement_document_signing_gate BEFORE UPDATE ON public.lease_contracts FOR EACH ROW EXECUTE FUNCTION public.require_agreement_documents_before_signing();


--
-- Name: agreement_template_document_requirements agreement_requirements_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agreement_requirements_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.agreement_template_document_requirements FOR EACH ROW EXECUTE FUNCTION public.protect_agreement_requirements();


--
-- Name: agreement_templates agreement_template_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agreement_template_immutable BEFORE UPDATE ON public.agreement_templates FOR EACH ROW EXECUTE FUNCTION public.protect_agreement_template();


--
-- Name: lease_contracts contract_end_reason_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contract_end_reason_guard BEFORE INSERT OR UPDATE ON public.lease_contracts FOR EACH ROW EXECUTE FUNCTION public.validate_contract_end_reason();


--
-- Name: master_contract_end_reasons contract_end_reason_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contract_end_reason_immutable BEFORE UPDATE ON public.master_contract_end_reasons FOR EACH ROW EXECUTE FUNCTION public.protect_used_contract_end_reason();


--
-- Name: lease_contracts deposit_contract_link_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposit_contract_link_guard BEFORE UPDATE ON public.lease_contracts FOR EACH ROW EXECUTE FUNCTION public.protect_deposit_contract_link();


--
-- Name: deposit_deduction_items deposit_deduction_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposit_deduction_guard BEFORE INSERT OR DELETE OR UPDATE ON public.deposit_deduction_items FOR EACH ROW EXECUTE FUNCTION public.protect_deposit_deduction();


--
-- Name: contract_deposit_settlements deposit_settlement_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposit_settlement_guard BEFORE INSERT OR DELETE OR UPDATE ON public.contract_deposit_settlements FOR EACH ROW EXECUTE FUNCTION public.validate_deposit_settlement();


--
-- Name: contract_deposit_transfers deposit_transfer_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposit_transfer_guard BEFORE INSERT OR DELETE OR UPDATE ON public.contract_deposit_transfers FOR EACH ROW EXECUTE FUNCTION public.validate_deposit_transfer();


--
-- Name: agent_commission_confirmations agent_commission_confirmations_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commission_confirmations
    ADD CONSTRAINT agent_commission_confirmations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_commission_confirmations agent_commission_confirmations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commission_confirmations
    ADD CONSTRAINT agent_commission_confirmations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: agent_invoices agent_invoices_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_invoices
    ADD CONSTRAINT agent_invoices_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_invoices agent_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_invoices
    ADD CONSTRAINT agent_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: agreement_documents agreement_documents_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: agreement_documents agreement_documents_document_type_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_document_type_code_fkey FOREIGN KEY (document_type_code) REFERENCES public.master_document_types(code) ON DELETE RESTRICT;


--
-- Name: agreement_documents agreement_documents_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: agreement_documents agreement_documents_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.agreement_documents(id) ON DELETE RESTRICT;


--
-- Name: agreement_documents agreement_documents_supersedes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_supersedes_document_id_fkey FOREIGN KEY (supersedes_document_id) REFERENCES public.agreement_documents(id) ON DELETE RESTRICT;


--
-- Name: agreement_documents agreement_documents_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_documents
    ADD CONSTRAINT agreement_documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: agreement_sign_invites agreement_sign_invites_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_sign_invites
    ADD CONSTRAINT agreement_sign_invites_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.lease_contracts(id) ON DELETE CASCADE;


--
-- Name: agreement_sign_invites agreement_sign_invites_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_sign_invites
    ADD CONSTRAINT agreement_sign_invites_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: agreement_template_document_requirements agreement_template_document_requirement_document_type_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_template_document_requirements
    ADD CONSTRAINT agreement_template_document_requirement_document_type_code_fkey FOREIGN KEY (document_type_code) REFERENCES public.master_document_types(code) ON DELETE RESTRICT;


--
-- Name: agreement_template_document_requirements agreement_template_document_requirements_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_template_document_requirements
    ADD CONSTRAINT agreement_template_document_requirements_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.agreement_templates(id) ON DELETE RESTRICT;


--
-- Name: agreement_templates agreement_templates_agreement_type_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_templates
    ADD CONSTRAINT agreement_templates_agreement_type_code_fkey FOREIGN KEY (agreement_type_code) REFERENCES public.master_agreement_types(code) ON DELETE RESTRICT;


--
-- Name: contacts contacts_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contract_deposit_settlements contract_deposit_settlements_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements
    ADD CONSTRAINT contract_deposit_settlements_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_settlements contract_deposit_settlements_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements
    ADD CONSTRAINT contract_deposit_settlements_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_settlements contract_deposit_settlements_lease_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_settlements
    ADD CONSTRAINT contract_deposit_settlements_lease_contract_id_fkey FOREIGN KEY (lease_contract_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_transfers contract_deposit_transfers_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers
    ADD CONSTRAINT contract_deposit_transfers_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_transfers contract_deposit_transfers_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers
    ADD CONSTRAINT contract_deposit_transfers_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_transfers contract_deposit_transfers_from_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers
    ADD CONSTRAINT contract_deposit_transfers_from_contract_id_fkey FOREIGN KEY (from_contract_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: contract_deposit_transfers contract_deposit_transfers_to_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_deposit_transfers
    ADD CONSTRAINT contract_deposit_transfers_to_contract_id_fkey FOREIGN KEY (to_contract_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: deposit_deduction_items deposit_deduction_items_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_deduction_items
    ADD CONSTRAINT deposit_deduction_items_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES public.contract_deposit_settlements(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts fk_contract_template_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT fk_contract_template_type FOREIGN KEY (template_id, agreement_type_code) REFERENCES public.agreement_templates(id, agreement_type_code) ON DELETE RESTRICT;


--
-- Name: leads fk_leads_tenant_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_tenant_id FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: lease_contracts fk_lease_agreement_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT fk_lease_agreement_type FOREIGN KEY (agreement_type_code) REFERENCES public.master_agreement_types(code) ON DELETE RESTRICT;


--
-- Name: lead_locations lead_locations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_locations
    ADD CONSTRAINT lead_locations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_match_results lead_match_results_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results
    ADD CONSTRAINT lead_match_results_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: lead_match_results lead_match_results_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_results
    ADD CONSTRAINT lead_match_results_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.lead_match_runs(id) ON DELETE CASCADE;


--
-- Name: lead_match_runs lead_match_runs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_runs
    ADD CONSTRAINT lead_match_runs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_match_runs lead_match_runs_run_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_match_runs
    ADD CONSTRAINT lead_match_runs_run_by_user_id_fkey FOREIGN KEY (run_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: lead_viewings lead_viewings_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_viewings
    ADD CONSTRAINT lead_viewings_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: lead_viewings lead_viewings_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_viewings
    ADD CONSTRAINT lead_viewings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_viewings lead_viewings_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_viewings
    ADD CONSTRAINT lead_viewings_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: leads leads_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: leads leads_desired_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_desired_room_type_id_fkey FOREIGN KEY (desired_room_type_id) REFERENCES public.master_room_types(id) ON DELETE RESTRICT;


--
-- Name: leads leads_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE SET NULL;


--
-- Name: leads leads_visa_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_visa_type_id_fkey FOREIGN KEY (visa_type_id) REFERENCES public.master_visa_types(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_end_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_end_reason_id_fkey FOREIGN KEY (end_reason_id) REFERENCES public.master_contract_end_reasons(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_end_recorded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_end_recorded_by_user_id_fkey FOREIGN KEY (end_recorded_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_original_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_original_contract_id_fkey FOREIGN KEY (original_contract_id) REFERENCES public.lease_contracts(id) ON DELETE SET NULL;


--
-- Name: lease_contracts lease_contracts_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lease_contracts lease_contracts_previous_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_previous_agreement_id_fkey FOREIGN KEY (previous_agreement_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_property_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_property_owner_id_fkey FOREIGN KEY (property_owner_id) REFERENCES public.property_owners(id) ON DELETE SET NULL;


--
-- Name: lease_contracts lease_contracts_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lease_contracts lease_contracts_room_tenancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_room_tenancy_id_fkey FOREIGN KEY (room_tenancy_id) REFERENCES public.room_tenancies(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_root_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_root_agreement_id_fkey FOREIGN KEY (root_agreement_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: master_facilities master_facilities_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_facilities
    ADD CONSTRAINT master_facilities_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.master_facilities_groups(id) ON DELETE CASCADE;


--
-- Name: properties properties_property_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_property_type_id_fkey FOREIGN KEY (property_type_id) REFERENCES public.master_property_types(id) ON DELETE RESTRICT;


--
-- Name: property_owners property_owners_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_owners
    ADD CONSTRAINT property_owners_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: property_owners property_owners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_owners
    ADD CONSTRAINT property_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rent_room_contacts rent_room_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_contacts
    ADD CONSTRAINT rent_room_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: rent_room_contacts rent_room_contacts_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_contacts
    ADD CONSTRAINT rent_room_contacts_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: rent_room_documents rent_room_documents_rent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_documents
    ADD CONSTRAINT rent_room_documents_rent_id_fkey FOREIGN KEY (rent_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: rent_room_prices rent_room_prices_contract_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_prices
    ADD CONSTRAINT rent_room_prices_contract_type_id_fkey FOREIGN KEY (contract_type_id) REFERENCES public.master_contract_types(id) ON DELETE RESTRICT;


--
-- Name: rent_room_prices rent_room_prices_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_room_prices
    ADD CONSTRAINT rent_room_prices_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: rent_rooms rent_rooms_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rent_rooms rent_rooms_listing_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_listing_source_id_fkey FOREIGN KEY (listing_source_id) REFERENCES public.master_listing_sources(id) ON DELETE RESTRICT;


--
-- Name: rent_rooms rent_rooms_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rent_rooms rent_rooms_properties_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_properties_id_fkey FOREIGN KEY (properties_id) REFERENCES public.properties(id) ON DELETE RESTRICT;


--
-- Name: rent_rooms rent_rooms_property_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_property_owner_id_fkey FOREIGN KEY (property_owner_id) REFERENCES public.property_owners(id) ON DELETE RESTRICT;


--
-- Name: rent_rooms rent_rooms_room_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_room_status_id_fkey FOREIGN KEY (room_status_id) REFERENCES public.master_room_statuses(id) ON DELETE RESTRICT;


--
-- Name: rent_rooms rent_rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rent_rooms
    ADD CONSTRAINT rent_rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.master_room_types(id) ON DELETE RESTRICT;


--
-- Name: room_facilities room_facilities_f_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities
    ADD CONSTRAINT room_facilities_f_id_fkey FOREIGN KEY (f_id) REFERENCES public.master_facilities(id) ON DELETE RESTRICT;


--
-- Name: room_facilities room_facilities_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities
    ADD CONSTRAINT room_facilities_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.master_facilities_groups(id) ON DELETE RESTRICT;


--
-- Name: room_facilities room_facilities_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_facilities
    ADD CONSTRAINT room_facilities_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: room_layout_values room_layout_values_layout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_layout_values
    ADD CONSTRAINT room_layout_values_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.master_layouts(id) ON DELETE RESTRICT;


--
-- Name: room_layout_values room_layout_values_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_layout_values
    ADD CONSTRAINT room_layout_values_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: room_medias room_medias_rent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_medias
    ADD CONSTRAINT room_medias_rent_id_fkey FOREIGN KEY (rent_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: room_share_links room_share_links_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links
    ADD CONSTRAINT room_share_links_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: room_share_links room_share_links_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links
    ADD CONSTRAINT room_share_links_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: room_share_links room_share_links_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_share_links
    ADD CONSTRAINT room_share_links_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE CASCADE;


--
-- Name: room_tenancies room_tenancies_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_tenancies
    ADD CONSTRAINT room_tenancies_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: room_tenancies room_tenancies_rent_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_tenancies
    ADD CONSTRAINT room_tenancies_rent_room_id_fkey FOREIGN KEY (rent_room_id) REFERENCES public.rent_rooms(id) ON DELETE RESTRICT;


--
-- Name: room_tenancies room_tenancies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_tenancies
    ADD CONSTRAINT room_tenancies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: tenant_bills tenant_bills_lease_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills
    ADD CONSTRAINT tenant_bills_lease_contract_id_fkey FOREIGN KEY (lease_contract_id) REFERENCES public.lease_contracts(id) ON DELETE RESTRICT;


--
-- Name: tenant_bills tenant_bills_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_bills
    ADD CONSTRAINT tenant_bills_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: tenants tenants_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: tenants tenants_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;


--
-- Name: tenants tenants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.master_roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_commission_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_commission_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_sign_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_sign_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_template_document_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_template_document_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_deposit_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_deposit_settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_deposit_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_deposit_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_deduction_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deposit_deduction_items ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_match_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_match_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_match_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_viewings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_viewings ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: master_agreement_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_agreement_types ENABLE ROW LEVEL SECURITY;

--
-- Name: master_contract_end_reasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_contract_end_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: master_contract_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_contract_types ENABLE ROW LEVEL SECURITY;

--
-- Name: master_document_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: master_facilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: master_facilities_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_facilities_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: master_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: master_listing_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_listing_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: master_property_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_property_types ENABLE ROW LEVEL SECURITY;

--
-- Name: master_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: master_room_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_room_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: master_room_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_room_types ENABLE ROW LEVEL SECURITY;

--
-- Name: master_visa_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_visa_types ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: property_owners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

--
-- Name: rent_room_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rent_room_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: rent_room_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rent_room_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: rent_room_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rent_room_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: rent_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rent_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: room_facilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: room_layout_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_layout_values ENABLE ROW LEVEL SECURITY;

--
-- Name: room_medias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_medias ENABLE ROW LEVEL SECURITY;

--
-- Name: room_share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: room_tenancies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_tenancies ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_bills ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- Data API lock-down

SELECT pg_catalog.set_config('search_path', 'public', false);

DO $$
DECLARE
  app_schema text := current_schema();
  t record;
  blocked text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO blocked
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = app_schema AND c.relkind = 'r'
    AND NOT pg_has_role(current_user, c.relowner, 'USAGE')
    AND NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user);
  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Role % neither owns nor bypasses RLS on: %. Enabling RLS would block the API.', current_user, blocked;
  END IF;

  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = app_schema AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', app_schema, t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon', app_schema);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon', app_schema);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', app_schema);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM authenticated', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM authenticated', app_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM authenticated', app_schema);
  END IF;
END $$;
