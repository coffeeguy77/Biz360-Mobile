import { Redirect, useLocalSearchParams } from "expo-router";
export default function ClauseDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/clause-detail/${id}` as any} />;
}
