import { Redirect, useLocalSearchParams } from "expo-router";
export default function DraftDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/draft-detail/${id}` as any} />;
}
