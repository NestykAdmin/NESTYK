import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupportedLocale } from "@nestyk/i18n";

type Section = "rooms" | "leads" | "tenants" | "tenantWork";
type Details = { section: Section; count?: number };
const descriptions: Record<SupportedLocale, Record<Section, string>> = {
  th: {
    rooms: "จัดการข้อมูลห้องและสถานะการปล่อยเช่า",
    leads: "ติดตามผู้สนใจและค้นหาห้องที่เหมาะกับลูกค้า",
    tenants: "ดูแลผู้เช่าและติดตามความคืบหน้าสัญญา",
    tenantWork: "ติดตามงานค้างและรายการที่ต้องดำเนินการของผู้เช่า",
  },
  en: {
    rooms: "Manage your rooms and rental availability",
    leads: "Follow up with leads and find suitable rooms",
    tenants: "Manage tenants and track contract progress",
    tenantWork: "Track outstanding tenant tasks and next steps",
  },
  zh: {
    rooms: "管理房源信息和出租状态",
    leads: "跟进潜在客户并寻找合适房源",
    tenants: "管理租客并跟进合同进度",
    tenantWork: "跟进租客待办事项",
  },
  ja: {
    rooms: "物件情報と賃貸状況を管理",
    leads: "見込み客のフォローと最適な物件探し",
    tenants: "入居者の管理と契約の進捗確認",
    tenantWork: "入居者に関する未対応タスクを確認",
  },
};
const Context = createContext<{
  pageKey: string;
  details: Details | null;
  publish: (pageKey: string, details: Details | null) => void;
} | null>(null);

/** Only the web workspace imports this provider; native screens keep their original headers. */
export function AgentPageHeaderProvider({
  pageKey,
  children,
}: {
  pageKey: string;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<{
    pageKey: string;
    details: Details;
  } | null>(null);
  const publish = useCallback((source: string, details: Details | null) => {
    setCurrent((previous) =>
      details
        ? { pageKey: source, details }
        : previous?.pageKey === source
          ? null
          : previous,
    );
  }, []);
  const value = useMemo(
    () => ({
      pageKey,
      details: current?.pageKey === pageKey ? current.details : null,
      publish,
    }),
    [pageKey, current, publish],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAgentListHeader(section: Section, count?: number) {
  const context = useContext(Context);
  const pageKey = context?.pageKey;
  const publish = context?.publish;
  useEffect(() => {
    if (pageKey == null || !publish) return;
    publish(pageKey, { section, count });
    return () => publish(pageKey, null);
  }, [pageKey, publish, section, count]);
}

export function useAgentPageHeader(locale: SupportedLocale) {
  const details = useContext(Context)?.details;
  return {
    count: details?.count,
    description: details ? descriptions[locale][details.section] : undefined,
  };
}
