import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { TintName } from '@/constants/theme';
import { STARTER_FRIDGE, type FridgeItem } from '@/data/fridge';

const TINT_CYCLE: TintName[] = ['butter', 'sky', 'mint', 'peach'];

type FridgeState = {
  items: FridgeItem[];
  addItem: (name: string) => void;
  removeItem: (name: string) => void;
  allergies: string[];
  toggleAllergy: (allergen: string) => void;
  saved: string[];
  toggleSaved: (recipeId: string) => void;
};

const FridgeContext = createContext<FridgeState | null>(null);

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FridgeItem[]>(STARTER_FRIDGE);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    setItems((current) => {
      const existing = new Set(current.map((item) => item.name.toLowerCase()));
      const newlyAdded = STARTER_FRIDGE.filter((item) => !existing.has(item.name.toLowerCase()));
      return newlyAdded.length === 0 ? current : [...current, ...newlyAdded];
    });
  }, [STARTER_FRIDGE]);

  const value = useMemo<FridgeState>(
    () => ({
      items,
      addItem: (raw) => {
        const name = raw.trim();
        if (!name) return;
        setItems((prev) =>
          prev.some((i) => i.name.toLowerCase() === name.toLowerCase())
            ? prev
            : [...prev, { name: name[0].toUpperCase() + name.slice(1), tint: TINT_CYCLE[prev.length % TINT_CYCLE.length] }]
        );
      },
      removeItem: (name) => setItems((prev) => prev.filter((i) => i.name !== name)),
      allergies,
      toggleAllergy: (allergen) =>
        setAllergies((prev) =>
          prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
        ),
      saved,
      toggleSaved: (id) =>
        setSaved((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])),
    }),
    [allergies, items, saved]
  );

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>;
}

export function useFridge() {
  const ctx = useContext(FridgeContext);
  if (!ctx) throw new Error('useFridge must be used inside FridgeProvider');
  return ctx;
}
