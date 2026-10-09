import { Entity, Column, Check, Unique } from "typeorm";
import { SerialEntity } from "./base.entity";
@Unique("master_agreement_types_code_key", ["code"])
@Check("chk_agreement_form_kind", "((form_kind)::text = ANY ((ARRAY['reservation'::character varying, 'lease'::character varying, 'broker_appointment'::character varying])::text[]))")
@Entity({ name: "master_agreement_types" })
export class MasterAgreementTypeEntity extends SerialEntity {
  @Column({ type: "varchar", length: 64 }) code: string;
  @Column({ type: "varchar", length: 255 }) name_th: string;
  @Column({ type: "varchar", length: 255 }) name_en: string;
  @Column({ type: "varchar", length: 64, default: "note" }) icon: string;
  @Column({ type: "varchar", length: 32 }) form_kind: "reservation" | "lease" | "broker_appointment";
  @Column({ type: "int", default: 0 }) sort_order: number;
  @Column({ type: "boolean", default: true }) is_active: boolean;
}
