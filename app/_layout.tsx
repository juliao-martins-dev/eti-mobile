import { getAccessToken } from "@/lib/storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;

    const guardRoutes = async () => {
      const token = await getAccessToken();
      if (!isMounted) return;

      const rootSegment = segments[0];
      const isAuthRoute = rootSegment === "(auth)";
      const isSplashRoute = rootSegment === undefined;
      const isPublicRoute = isAuthRoute || isSplashRoute;

      if (!token && !isPublicRoute) {
        router.replace("/(auth)");
        return;
      }

      if (token && isPublicRoute) {
        router.replace("/(eti)");
      }
    };

    guardRoutes();

    return () => {
      isMounted = false;
    };
  }, [router, segments]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(eti)" options={{ headerShown: false }} />
      <Stack.Screen
        name="announcement"
        options={{
          title: "Anuncio",
          presentation: "formSheet",
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen name="clock" options={{ title: "Registu Prezensa" }} />
    </Stack>
  );
}
