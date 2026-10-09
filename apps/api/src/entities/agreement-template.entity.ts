import { Entity, Column, ManyToOne, JoinColumn, Check, Unique } from "typeorm";
import { SerialEntity } from "./base.entity";
import { MasterAgreementTypeEntity } from "./master-agreement-type.entity";

@Unique("agreement_templates_agreement_type_code_version_key", ["agreement_type_code", "version"])
@Unique("agreement_templates_id_agreement_type_code_key", ["id", "agreement_type_code"])
@Check("agreement_templates_data_schema_check", "(jsonb_typeof(data_schema) = 'object'::text)")
@Check("agreement_templates_form_kind_check", "((form_kind)::text = ANY ((ARRAY['reservation'::character varying, 'lease'::character varying, 'broker_appointment'::character varying])::text[]))")
@Check("agreement_templates_version_check", "(version > 0)")
@Entity({ name: "agreement_templates" })
export class AgreementTemplateEntity extends SerialEntity {
  @Column({ type: "varchar", length: 64 }) agreement_type_code: string;
  @Column({ type: "int" }) version: number;
  @Column({ type: "varchar", length: 255 }) name: string;
  @Column({ type: "varchar", length: 32 }) form_kind: "reservation" | "lease" | "broker_appointment";
  @Column({ type: "jsonb" }) data_schema: Record<string, unknown>;
  @Column({ type: "text", nullable: true }) document_template_key:
    string | null;
  @Column({ type: "boolean", default: true }) is_active: boolean;
  @ManyToOne(() => MasterAgreementTypeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_type_code", referencedColumnName: "code", foreignKeyConstraintName: "agreement_templates_agreement_type_code_fkey" })
  agreement_type: MasterAgreementTypeEntity;
}
