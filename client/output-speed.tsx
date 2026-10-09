import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Text, View } from "react-native";
import type { z } from "zod";
import { formatSpeed, measurementSchema } from "../shared/speed";

export function OutputSpeed({ item, theme, layout }: PluginTimelineItemProps<z.output<typeof measurementSchema>>) {
  const label = formatSpeed(item.data);
  const explanation = item.data.timing === "text-stream-itl"
    ? "Text-Streamingrate: sichtbare Antwort-Tokens minus eins, geteilt durch die Zeit vom ersten bis zum letzten Text-Chunk. Vorlauf und versteckte Denk-Tokens ausgeschlossen. Clientseitige Näherung."
    : item.data.timing === "turn-runtime"
      ? "Ältere effektive Ausgaberate inklusive Denkzeit und Vorlauf, ohne Tool-Laufzeiten und Freigabewartezeiten."
      : "Ältere Näherung aus beobachteter Ausgabe und Streamingzeit, ohne Tool-Zeiten.";
  return (
    <View style={{ alignItems: "flex-end", paddingVertical: layout.compact ? 2 : 4 }}>
      <Text
        accessibilityLabel={`${label}. ${explanation}`}
        style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}
      >
        {label}
      </Text>
    </View>
  );
}
