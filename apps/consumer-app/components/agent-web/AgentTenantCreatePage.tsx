import React from "react";
import { TenantForm } from "../TenantForm";
import type { AgentTenantCreatePageProps } from "./AgentTenantCreatePage.types";

/** Native / phone fallback: the app's create-tenant form (pick lead, pick room, confirm in the sheet). */
export function AgentTenantCreatePage({ onBusy, backRef, onCreated, onDone }: AgentTenantCreatePageProps) {
  return (
    <TenantForm
      onBusy={onBusy}
      backRef={backRef}
      onCreated={(tenant) => {
        onCreated(tenant);
        onDone(tenant, "tenant");
      }}
    />
  );
}
