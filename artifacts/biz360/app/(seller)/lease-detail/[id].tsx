import { Redirect, useLocalSearchParams } from "expo-router";
export default function LeaseDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/lease-detail/${id}` as any} />;
}
