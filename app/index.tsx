import LoadingBar from "@/components/LoadingBar";
import { getAccessToken } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      getAccessToken()
        .then((token) => {
          router.replace(token ? "/(eti)" : "/(auth)");
        })
        .catch(() => {
          router.replace("/(auth)");
        });
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require("@/assets/images/eti.jpg")}
          style={styles.logo}
        />

        {/* Subtitle */}
        <Text style={styles.subtitle}>ETI PRESENSA</Text>

        {/* Loading */}
        <LoadingBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
});
