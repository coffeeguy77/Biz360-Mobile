import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "biz360_saved_v1";

export async function getSavedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function setSavedIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
}

export async function toggleSaved(id: string): Promise<string[]> {
  const ids  = await getSavedIds();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  await setSavedIds(next);
  return next;
}
