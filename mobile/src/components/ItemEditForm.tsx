import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "./Icon";
import { updateItem } from "../api/client";
import type { ClosetItem } from "../api/types";
import { COLOR_NAMES, PATTERNS, asList, capitalize, colors, hitSlopFor, palettes, radius, swatchFor, type } from "../theme";
import { haptics } from "../haptics";
import { Button, Chip } from "../ui";
import { garmentName } from "../garmentName";
import { CATEGORY_GROUPS } from "../categoryGroups";

// Group shortcuts fill the type with a plain word; the free text stays for anything more specific.
const GROUP_WORDS: Partial<Record<(typeof CATEGORY_GROUPS)[number], string>> = {
  Tops: "top", Outerwear: "jacket", Bottoms: "pants", Dresses: "dress", Shoes: "shoes", Bags: "bag", Accessories: "accessory",
};

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
          borderRadius: radius.input,
          paddingHorizontal: 14, paddingVertical: 12, ...type.body, color: colors.label, backgroundColor: colors.grouped,
        }}
      />
    </View>
  );
}

type Props = { item: ClosetItem; onSaved: (updated: ClosetItem) => void; onCancel: () => void };

export function ItemEditForm({ item, onSaved, onCancel }: Props) {
  const { facts } = item;
  const currentName = facts.name ? asList(facts.name.value)[0] ?? "" : "";
  const [name, setName] = useState(currentName);
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
      const newName = name.trim();
      const updated = await updateItem(item, {
        ...(newName && newName !== currentName ? { name: newName } : {}),
        category, colors: picked, pattern, trims, visible_text: text,
      });
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
      <Field label="Name" value={name} onChange={setName} placeholder={garmentName({ facts: { ...facts, name: null } })} />
      <Field label="Type" value={category} onChange={setCategory} placeholder="Fleece" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {(Object.entries(GROUP_WORDS) as [string, string][]).map(([group, word]) => (
          <Chip key={group} label={group} selected={category.trim().toLowerCase() === word} onPress={() => setCategory(word)} />
        ))}
      </View>

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
        {PATTERNS.map((p) => (
          <Chip key={p} label={capitalize(p)} selected={p === pattern} onPress={() => setPattern(p)} />
        ))}
      </View>

      <Field label="Details" value={trims} onChange={setTrims} placeholder="Half zip, white piping" />
      <Field label="Text on the garment" value={text} onChange={setText} placeholder="Leave empty if none" />

      {error ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 16 }}>{error}</Text> : null}

      <View style={{ gap: 10, marginTop: 28 }}>
        <Button title="Save" onPress={save} loading={saving} />
        <Button title="Cancel" variant="text" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}
