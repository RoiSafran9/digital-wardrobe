---
name: kips-icons
description: Use when adding, choosing, replacing or reviewing an icon in the KIPS mobile app (mobile/), including icons for new options, filters, tiles, buttons, rows or empty states, or when someone asks for icons "in the same style". Keeps new icons in the approved KIPS icon language.
---

# KIPS icons

The approved icon language is written down in `docs/design/ICONS.md`. Read it first; it overrides any general
icon or illustration habit (no emoji, 3D, illustrations or AI-generated icons).

## Steps
1. Read `docs/design/ICONS.md` (rules 1–9, reserved symbols) and look at `docs/design/icons/reference.png`.
2. Pick an SF Symbol per item: outline variant, a literal everyday object, different silhouette from its siblings,
   not a reserved symbol. Confirm each name exists:
   `grep "'<name>'" mobile/node_modules/sf-symbols-typescript/dist/index.d.ts`
3. Render the whole group as the app draws it, light and dark, and show it to the owner for approval before coding:
   `swift scripts/icon_sheet.swift <scratchpad>/icons.png "Label=sf.symbol" ...` (prints MISSING for an unknown name).
4. After approval, add entries to `ICONS` in `mobile/src/components/Icon.tsx` (key by meaning, Ionicons `*-outline`
   fallback) and use the role's size/weight from rule 3 (choice icons: 24pt `semibold` on `OptionTile`).
5. Run `cd mobile && npx jest && npx tsc --noEmit`; say that the phone check (light + dark) is still owed if not done.
6. If a new symbol gets an app-wide meaning, add it to the reserved table in `docs/design/ICONS.md`.
