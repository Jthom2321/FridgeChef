import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { TintName } from '@/constants/theme';
import { STARTER_FRIDGE, type FridgeItem } from '@/data/recipes';

const TINT_CYCLE: TintName[] = ['butter', 'sky', 'mint', 'peach'];

type FridgeState = {
  items: FridgeItem[];
  addItem: (name: string) => void;
  removeItem: (name: string) => void;
  saved: string[];
  toggleSaved: (recipeId: string) => void;
  allergies: string[];
  toggleAllergy: (allergy: string) => void;
};

const FridgeContext = createContext<FridgeState | null>(null);

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FridgeItem[]>(STARTER_FRIDGE);
  const [saved, setSaved] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);

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
      saved,
      toggleSaved: (id) =>
        setSaved((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])),
      allergies,
      toggleAllergy: (allergy) =>
        setAllergies((prev) => (prev.includes(allergy) ? prev.filter((item) => item !== allergy) : [...prev, allergy])),
    }),
    [items, saved, allergies]
  );

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>;
}

export function useFridge() {
  const ctx = useContext(FridgeContext);
  if (!ctx) throw new Error('useFridge must be used inside FridgeProvider');
  return ctx;
}
