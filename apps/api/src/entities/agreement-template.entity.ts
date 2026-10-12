import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { SerialEntity } from "./base.entity";
import { MasterAgreementTypeEntity } from "./master-agreement-type.entity";

@Entity({ name: "agreement_templates" })
export class AgreementTemplateEntity extends SerialEntity {
  @Column({ type: "varchar", length: 64 }) agreement_type_code: string;
  @Column({ type: "int" }) version: number;
  @Column({ type: "varchar", length: 255 }) name: string;
  @Column({ type: "varchar", length: 32 }) form_kind: "reservation" | "lease" | "broker_appointment" | "renewal";
  @Column({ type: "jsonb" }) data_schema: Record<string, unknown>;
  @Column({ type: "text", nullable: true }) document_template_key:
    string | null;
  @Column({ type: "boolean", default: true }) is_active: boolean;
  @ManyToOne(() => MasterAgreementTypeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_type_code", referencedColumnName: "code" })
  agreement_type: MasterAgreementTypeEntity;
}
