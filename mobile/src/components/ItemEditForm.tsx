import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "./Icon";
import { updateItem } from "../api/client";
import type { ClosetItem } from "../api/types";
import { COLOR_NAMES, PATTERNS, asList, capitalize, colors, hitSlopFor, palettes, radius, swatchFor, type } from "../theme";
import { haptics } from "../haptics";
import { PillButton } from "./PillButton";

const LIGHT_SWATCHES = new Set(["white", "beige", "yellow", "mint", "dusty pink", "pink"]);

function Label({ children }: { children: string }) {
  return <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginBottom: 8, marginTop: 20 }}>{children}</Text>;
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel}
        style={{
          borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 12, ...type.body, color: colors.label, backgroundColor: colors.grouped,
        }}
      />
    </View>
  );
}

type Props = { item: ClosetItem; onSaved: (updated: ClosetItem) => void; onCancel: () => void };

export function ItemEditForm({ item, onSaved, onCancel }: Props) {
  const { facts } = item;
  const [category, setCategory] = useState(asList(facts.category.value)[0] ?? "");
  const [picked, setPicked] = useState<string[]>(asList(facts.colors.value).map((c) => c.toLowerCase()));
  const [pattern, setPattern] = useState(asList(facts.pattern.value)[0] ?? "solid");
  const [trims, setTrims] = useState(asList(facts.trims.value).join(", "));
  const [text, setText] = useState(asList(facts.visible_text.value).join(" "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleColor = (name: string) =>
    setPicked((current) => (current.includes(name) ? current.filter((c) => c !== name) : [...current, name]));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateItem(item, { category, colors: picked, pattern, trims, visible_text: text });
      haptics.success();
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Field label="Type" value={category} onChange={setCategory} placeholder="Fleece" />

      <Label>Colors</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {COLOR_NAMES.map((name) => {
          const on = picked.includes(name);
          return (
            <Pressable
              key={name}
              accessibilityRole="checkbox"
              accessibilityLabel={`Color ${name}`}
              accessibilityState={{ checked: on }}
              onPress={() => toggleColor(name)}
              hitSlop={hitSlopFor(34, 34)}
              style={{
                width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                backgroundColor: swatchFor(name), borderWidth: on ? 2.5 : 1,
                borderColor: on ? colors.label : colors.separatorStrong,
              }}
            >
              {/* Swatches are fixed garment colors, so the check uses fixed ink/white too. */}
              {on ? <Icon name="checkmark" size={16} color={LIGHT_SWATCHES.has(name) ? palettes.light.label : "#FFFFFF"} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Label>Pattern</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PATTERNS.map((name) => {
          const on = name === pattern;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={capitalize(name)}
              accessibilityState={{ selected: on }}
              onPress={() => setPattern(name)}
              hitSlop={hitSlopFor(30)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
                backgroundColor: on ? colors.tint : colors.grouped,
              }}
            >
              <Text style={{ ...type.subhead, color: on ? colors.onTint : colors.label }}>{capitalize(name)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Details" value={trims} onChange={setTrims} placeholder="Half zip, white piping" />
      <Field label="Text on the garment" value={text} onChange={setText} placeholder="Leave empty if none" />

      {error ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 16 }}>{error}</Text> : null}

      <View style={{ gap: 10, marginTop: 28 }}>
        <PillButton label={saving ? "Saving…" : "Save"} variant="primary" onPress={save} disabled={saving} />
        <PillButton label="Cancel" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}
