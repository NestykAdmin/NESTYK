import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { isPdfDocumentUrl, pdfViewerHtml } from "../lib/pdf-viewer/html";
export { isPdfDocumentUrl } from "../lib/pdf-viewer/html";

export function ContractDocumentPreview({ url }: { url: string }) {
  const html = useMemo(
    () => (isPdfDocumentUrl(url) ? pdfViewerHtml(url) : null),
    [url],
  );
  return (
    <View style={styles.box}>
      {html ? (
        React.createElement("iframe", {
          key: url,
          srcDoc: html,
          title: "เอกสารจอง",
          sandbox: "allow-scripts",
          referrerPolicy: "no-referrer",
          style: {
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          },
        })
      ) : (
        <Image
          source={{ uri: url }}
          style={styles.image}
          contentFit="contain"
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: 240,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
});
