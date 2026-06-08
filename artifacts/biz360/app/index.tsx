import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(tabs)/discover" />;
  }

  if (user.role === "seller") return <Redirect href="/(seller)/dashboard" />;
  if (user.role === "broker") return <Redirect href="/(broker)/dashboard" />;
  if (user.role === "admin") return <Redirect href="/(admin)/listings" />;
  return <Redirect href="/(tabs)/discover" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071221",
  },
});
