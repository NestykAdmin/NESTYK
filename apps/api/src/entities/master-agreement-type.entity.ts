import { Entity, Column } from "typeorm";
import { SerialEntity } from "./base.entity";
@Entity({ name: "master_agreement_types" })
export class MasterAgreementTypeEntity extends SerialEntity {
  @Column({ type: "varchar", length: 64, unique: true }) code: string;
  @Column({ type: "varchar", length: 255 }) name_th: string;
  @Column({ type: "varchar", length: 255 }) name_en: string;
  @Column({ type: "varchar", length: 64, default: "note" }) icon: string;
  @Column({ type: "varchar", length: 32 }) form_kind: "reservation" | "lease" | "broker_appointment" | "renewal";
  @Column({ type: "int", default: 0 }) sort_order: number;
  @Column({ type: "boolean", default: true }) is_active: boolean;
}
