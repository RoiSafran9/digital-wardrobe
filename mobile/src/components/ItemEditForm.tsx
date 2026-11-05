import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { updateItem } from "../api/client";
import type { ClosetItem } from "../api/types";
import { COLOR_NAMES, PATTERNS, asList, capitalize, colors, radius, swatchFor, type, weight } from "../theme";
import { haptics } from "../haptics";
import { Button, Chip, Glass, IconButton, Swatch } from "../ui";
import { garmentName } from "../garmentName";
import { GarmentImage } from "./GarmentImage";
import { CATEGORY_GROUPS } from "../categoryGroups";

// Group shortcuts fill the type with a plain word; the free text stays for anything more specific.
const GROUP_WORDS: Partial<Record<(typeof CATEGORY_GROUPS)[number], string>> = {
  Tops: "top", Outerwear: "jacket", Bottoms: "pants", Dresses: "dress", Shoes: "shoes", Bags: "bag", Accessories: "accessory",
};

// A small uppercase field name.
function Label({ children, first }: { children: string; first?: boolean }) {
  return (
    <Text style={{ ...type.caption, ...weight(600), textTransform: "uppercase", letterSpacing: 0.6, color: colors.secondaryLabel, marginTop: first ? 0 : 20, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

const field = {
  height: 44, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 0,
  backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator,
  ...type.body, color: colors.label,
} as const;

// A row of the Details / Text list: the field name on the left, the editable value on the right.
function ListField({ label, accessibilityLabel, value, onChange, placeholder, first }: {
  label: string; accessibilityLabel: string; value: string; onChange: (v: string) => void; placeholder: string; first?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
      <Text style={{ ...type.body, color: colors.label }}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel}
        style={{ ...type.body, color: colors.label, flex: 1, textAlign: "right", paddingVertical: 12 }}
      />
    </View>
  );
}

type Props = {
  item: ClosetItem;
  onSaved: (updated: ClosetItem) => void;
  onCancel: () => void;
  onClose: () => void;  // the × (the sheet asks before discarding edits)
};

// Editing a closet item: a bar with Save that stays put, then name, type, colors, pattern, details and
// printed text. Only what the user changes is sent; the server checks it.
export function ItemEditForm({ item, onSaved, onCancel, onClose }: Props) {
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
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, minHeight: 64 }}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        <Text accessibilityRole="header" style={{ ...type.subhead, ...weight(600), color: colors.label }}>Editing</Text>
        <View style={{ minWidth: 40, alignItems: "flex-end" }}>
          <Button title="Save" variant="text" onPress={save} loading={saving} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GarmentImage
            path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
            style={{ width: 72, height: 88, borderRadius: radius.image + 2, backgroundColor: colors.tile }}
          />
          <View style={{ flex: 1 }}>
            <Label first>Name</Label>
            <TextInput
              accessibilityLabel="Name"
              value={name}
              onChangeText={setName}
              placeholder={garmentName({ facts: { ...facts, name: null } })}
              placeholderTextColor={colors.secondaryLabel}
              style={field}
            />
          </View>
        </View>

        <Label>Type</Label>
        <TextInput
          accessibilityLabel="Type"
          value={category}
          onChangeText={setCategory}
          placeholder="Fleece"
          placeholderTextColor={colors.secondaryLabel}
          style={field}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {(Object.entries(GROUP_WORDS) as [string, string][]).map(([group, word]) => (
            <Chip key={group} label={group} selected={category.trim().toLowerCase() === word} onPress={() => setCategory(word)} />
          ))}
        </View>

        <Label>Colors</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {COLOR_NAMES.map((name) => (
            <Swatch key={name} color={swatchFor(name)} label={`Color ${name}`} selected={picked.includes(name)} onPress={() => toggleColor(name)} />
          ))}
        </View>

        <Label>Pattern</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PATTERNS.map((p) => (
            <Chip key={p} label={capitalize(p)} selected={p === pattern} onPress={() => setPattern(p)} />
          ))}
        </View>

        <Glass radius={radius.list} level="card" style={{ marginTop: 20 }}>
          <View style={{ borderRadius: radius.list, overflow: "hidden" }}>
            <ListField first label="Details" accessibilityLabel="Details" value={trims} onChange={setTrims} placeholder="Half zip, white piping" />
            <ListField label="Text" accessibilityLabel="Text on the garment" value={text} onChange={setText} placeholder="Leave empty if none" />
          </View>
        </Glass>

        {error ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 16 }}>{error}</Text> : null}

        <View style={{ marginTop: 14 }}>
          <Button title="Cancel" variant="text" onPress={onCancel} disabled={saving} />
        </View>
      </ScrollView>
    </View>
  );
}
