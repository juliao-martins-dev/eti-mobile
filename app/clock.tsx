import Feather from "@expo/vector-icons/Feather";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiErrorMessage } from "@/lib/api";
import { displayName, getCachedUser, userField } from "@/lib/auth";
import { getCurrentCoords, LocationError } from "@/lib/location";
import { clock, formatClockTime, type ClockMode } from "@/lib/prezensa";
import type { AuthUser } from "@/lib/storage";

export default function ClockPresence() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isUploading, setIsUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: ClockMode = params.mode === "out" ? "out" : "in";

  useEffect(() => {
    let isMounted = true;

    getCachedUser().then((cached) => {
      if (isMounted) setUser(cached);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing || !permission?.granted) return;

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        // Full quality produces multi-MB files that stall the upload; 0.6 is
        // ample for an attendance photo and uploads in a fraction of the time.
        quality: 0.6,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch (error) {
      console.error("Failed to capture photo:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoUri || isUploading) return;

    setIsUploading(true);

    try {
      const coords = await getCurrentCoords();
      await clock(mode, photoUri, coords);
      router.replace("/(eti)");
    } catch (e) {
      if (e instanceof LocationError) {
        alert(e.message);
      } else {
        alert(apiErrorMessage(e, "Falla koko manda fila fali!"));
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (photoUri) {
    return (
      <SafeAreaView style={[styles.container, styles.containerPreview]}>
        <View style={styles.headerPreview}>
          <Text style={styles.headerPreviewNameText}>
            {displayName(user, "-")}
          </Text>
          <Text style={styles.headerPreviewIdText}>
            {userField(user, ["numeru", "nip", "employee_id", "id"], "-")}
          </Text>
        </View>

        <Image
          contentFit="cover"
          source={{ uri: photoUri }}
          style={styles.previewImage}
        />

        <View style={styles.clockInfoPreview}>
          <Text style={styles.clockTextPreview}>
            {mode === "in" ? "Horas Tama" : "Horas Fila"}
          </Text>
          <View style={styles.clockSeparator} />
          <Text style={styles.clockTimePreview}>{formatClockTime(now)}</Text>
        </View>

        <Pressable
          style={styles.previewButton}
          onPress={handleUploadPhoto}
          disabled={isUploading}
        >
          <Feather name="log-in" size={24} color="#fff" />
          <Text style={styles.previewButtonText}>
            Rejista oras servisu nian
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Feather name="camera" size={32} color="#007AFF" />
          </View>
          <Text style={styles.permissionTitle}>Hein kamera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const isBlocked = !permission.canAskAgain;

    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Feather name="camera-off" size={32} color="#007AFF" />
          </View>

          <Text style={styles.permissionTitle}>Presiza asesu ba kamera</Text>
          <Text style={styles.permissionSubtitle}>
            Ami presiza kamera atu hasai foto ba rejistu oras tama no sai. Favór
            fo autorizasaun asesu ba kamera atu bele kontinua.
          </Text>

          <Pressable
            style={styles.permissionButtonPrimary}
            onPress={() =>
              isBlocked ? Linking.openSettings() : requestPermission()
            }
          >
            <Text style={styles.permissionButtonPrimaryText}>
              {isBlocked ? "Loke konfigurasaun" : "Permite asesu ba kamera"}
            </Text>
          </Pressable>

          {!isBlocked && (
            <Pressable
              style={styles.permissionButtonSecondary}
              onPress={() => router.back()}
            >
              <Text style={styles.permissionButtonSecondaryText}>
                Lae agora
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        mute={true}
        style={styles.camera}
        facing="front"
      />

      <View style={styles.bottomBar}>
        <View style={styles.captureOuter}>
          <Pressable
            style={[
              styles.captureButton,
              isCapturing && styles.captureDisabled,
            ]}
            onPress={capturePhoto}
            disabled={isCapturing}
          >
            <View style={styles.captureInner} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#f3f7ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#fff",
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#001F54",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  permissionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e9f2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0b1b3d",
    textAlign: "center",
  },
  permissionSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#44526b",
    marginBottom: 24,
  },
  permissionButtonPrimary: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionButtonPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  permissionButtonSecondary: {
    marginTop: 12,
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8d3e6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  permissionButtonSecondaryText: {
    color: "#30496e",
    fontSize: 16,
    fontWeight: "500",
  },
  containerPreview: {
    paddingTop: 30,
    alignItems: "center",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  preview: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    marginVertical: 40,
    width: 200,
    aspectRatio: 3 / 4,
    borderRadius: 20,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    // Android shadow
    elevation: 10,
    backgroundColor: "#fff", // WAJIB untuk Android
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 185,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureDisabled: {
    opacity: 0.6,
  },
  headerPreview: {
    alignItems: "center",
    rowGap: 5,
  },
  headerPreviewNameText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerPreviewIdText: {
    fontSize: 16,
    color: "#555",
    fontWeight: 500,
  },
  clockInfoPreview: {
    alignItems: "center",
    rowGap: 10,
  },
  clockTextPreview: {
    fontSize: 16,
  },
  clockSeparator: {
    width: 200,
    height: 1,
    backgroundColor: "#ccc",
  },
  clockTimePreview: {
    fontSize: 16,
    fontWeight: "bold",
  },
  previewButton: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 30,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    position: "absolute",
    bottom: 40,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: 500,
    color: "#fff",
  },
});
