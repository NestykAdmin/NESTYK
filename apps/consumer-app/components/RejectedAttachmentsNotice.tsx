import React from "react";
import { Text, View } from "react-native";
import { tokens } from "@nestyk/ui/native";
import type { RejectedAttachmentNotice } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";

/** B3: tells whoever signs which attached documents the agent rejected (signing is not blocked). */
export function RejectedAttachmentsNotice({ items }: { items: RejectedAttachmentNotice[] }) {
  const { t } = useLocale();
  const copy = t.contracts.rejectedNotice;
  if (!items.length) return null;
  const text = { color: "#991B1B", fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 }}
    >
      <Text style={{ ...text, fontFamily: tokens.typography.native.headingTh }}>
        {fillTemplate(copy.title, { count: String(items.length) })}
      </Text>
      {items.map((item, index) => (
        <Text key={index} style={text}>
          {"• "}
          {item.note ? fillTemplate(copy.itemWithNote, { name: item.name, note: item.note }) : item.name}
        </Text>
      ))}
      <Text style={text}>{copy.hint}</Text>
    </View>
  );
}
