import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { apiGet, apiSet } from "./apiStore";

const HIDDEN_KEY = "biz360_hidden_listing_ids";

export async function getHiddenIds(): Promise<string[]> {
  try {
    const data = await apiGet<string[]>(HIDDEN_KEY);
    return data ?? [];
  } catch { return []; }
}

export async function hideListing(id: string): Promise<void> {
  const current = await getHiddenIds();
  if (!current.includes(id)) {
    await apiSet(HIDDEN_KEY, [...current, id]);
  }
}

export function useHiddenListings() {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHiddenIds().then((ids) => { if (active) setHiddenIds(ids); });
      return () => { active = false; };
    }, []),
  );

  const hide = async (id: string) => {
    setHiddenIds((prev) => [...prev, id]);
    await hideListing(id);
  };

  return { hiddenIds, hide };
}
