import Feather from "@expo/vector-icons/Feather";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiErrorMessage } from "@/lib/api";
import { displayName, getCachedUser, staffNumber } from "@/lib/auth";
import {
  recordMarkaFailure,
  recordMarkaSuccess,
  type FeedLevel,
} from "@/lib/feed";
import { fetchKonfig } from "@/lib/konfig";
import { getCurrentCoords, LocationError } from "@/lib/location";
import { notifyNow } from "@/lib/notifications";
import {
  formatOrasAgora,
  marka,
  PrezensaError,
  sesaunLabels,
  type MarkaTipu,
} from "@/lib/prezensa";
import type { AuthUser } from "@/lib/storage";
import { sesaunBaMarka } from "@/lib/marka-flow";

/**
 * What the server said about the marka just sent.
 *
 * `ok` is kept separate from `level`: a late punch is a **success** the
 * server recorded, but it is levelled `warning` so the teacher sees it was
 * late. Deciding from `level` alone would send them back to the camera.
 */
type Outcome = {
  ok: boolean;
  level: FeedLevel;
  title: string;
  message: string;
};

export default function RegisterPrezensa() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isUploading, setIsUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // ?tipu=checkin|checkout — named after the endpoint that records it.
  const params = useLocalSearchParams<{ tipu?: string }>();
  const tipu: MarkaTipu = params.tipu === "checkout" ? "checkout" : "checkin";

  useEffect(() => {
    let isMounted = true;

    getCachedUser().then((cached) => {
      if (isMounted) setUser(cached);
    });

    // Warms limite_sesaun so the session label matches the server's cut-off.
    fetchKonfig();

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

    setError(null);

    try {
      const coords = await getCurrentCoords();
      // Names the half of the day this punch belongs to, so the afternoon
      // does not have to wait for the clock. Null leaves it to the server.
      const sesaun = await sesaunBaMarka(tipu);
      const result = await marka(tipu, photoUri, coords, sesaun);

      // `duplicate` counts as success — the marka is already stored.
      const entry = await recordMarkaSuccess(result);
      await notifyNow(entry.title, entry.message);

      // The teacher confirms before leaving, so the result is never missed.
      setOutcome({ ok: true, ...entry });
    } catch (e) {
      // A network error carries no server wording; give it readable text
      // before it reaches the feed.
      const failure =
        e instanceof LocationError || e instanceof PrezensaError
          ? e
          : new Error(apiErrorMessage(e, "Falla koko manda fila fali!"));

      const entry = await recordMarkaFailure(tipu, failure);
      await notifyNow(entry.title, entry.message);

      // Kept under the photo after the modal closes: a failed marka must
      // stay visible while the teacher decides whether to try again.
      setError(entry.message);
      setOutcome({ ok: false, ...entry });
    } finally {
      setIsUploading(false);
    }
  };

  /** Success leaves for the home screen; failure stays so it can be retried. */
  const dismissOutcome = () => {
    const succeeded = outcome?.ok;
    setOutcome(null);

    if (succeeded) router.replace("/(eti)");
  };

  if (photoUri) {
    // Which column this marka lands in, per the server's limite_sesaun.
    const { sesaun, asaun } = sesaunLabels(tipu, now);

    return (
      // Only the bottom edge: the stack header already covers the top.
      <SafeAreaView style={styles.previewScreen} edges={["bottom"]}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewName} numberOfLines={1}>
            {displayName(user, "-")}
          </Text>
          <Text style={styles.previewId}>{staffNumber(user)}</Text>
        </View>

        {/* Takes every pixel the fixed rows leave, so nothing ever overflows. */}
        <View style={styles.photoWrap}>
          <Image
            contentFit="cover"
            source={{ uri: photoUri }}
            style={styles.previewImage}
          />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sesaunLabel}>{sesaun}</Text>

          <View style={styles.asaunRow}>
            <Feather
              name={tipu === "checkin" ? "log-in" : "log-out"}
              size={18}
              color="#007AFF"
            />
            <Text style={styles.asaunText}>{asaun}</Text>
          </View>

          <View style={styles.statusSeparator} />

          <View style={styles.timeRow}>
            <Text style={styles.statusTime}>{formatOrasAgora(now)}</Text>
            <Text style={styles.statusZone}>OTL</Text>
          </View>
        </View>

        {error ? <Text style={styles.previewError}>{error}</Text> : null}

        <Pressable
          style={[styles.previewButton, isUploading && styles.previewButtonBusy]}
          onPress={handleUploadPhoto}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Feather name="check" size={22} color="#fff" />
          )}
          <Text style={styles.previewButtonText}>
            {isUploading ? "Haruka..." : "Rejistu"}
          </Text>
        </Pressable>

        <OutcomeModal outcome={outcome} onClose={dismissOutcome} />
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

/** How each level is dressed — the same three the notification list uses. */
const OUTCOME_LOOK = {
  success: { icon: "check-circle", tint: "#16A34A", wash: "#E8F7EE" },
  warning: { icon: "alert-triangle", tint: "#B45309", wash: "#FDF3E3" },
  info: { icon: "info", tint: "#2563EB", wash: "#E8F0FE" },
} as const satisfies Record<
  FeedLevel,
  { icon: keyof typeof Feather.glyphMap; tint: string; wash: string }
>;

/**
 * The result of the marka, held on screen until the teacher acknowledges it.
 *
 * The same wording already went to the phone's notification tray and the
 * in-app list; this is the third place, so the outcome cannot be missed.
 */
function OutcomeModal({
  outcome,
  onClose,
}: {
  outcome: Outcome | null;
  onClose: () => void;
}) {
  // Nothing is rendered between punches, so no stale message can flash.
  if (!outcome) return null;

  const look = OUTCOME_LOOK[outcome.level];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android's back button must not skip past the result.
      onRequestClose={onClose}
    >
      <Pressable style={styles.outcomeBackdrop} onPress={onClose}>
        {/* Swallows taps so pressing the card itself does not dismiss it. */}
        <Pressable style={styles.outcomeCard} onPress={() => {}}>
          <View style={[styles.outcomeIcon, { backgroundColor: look.wash }]}>
            <Feather name={look.icon} size={30} color={look.tint} />
          </View>

          <Text style={styles.outcomeTitle}>{outcome.title}</Text>
          <Text style={styles.outcomeMessage}>{outcome.message}</Text>

          <Pressable
            style={[styles.outcomeButton, { backgroundColor: look.tint }]}
            onPress={onClose}
          >
            <Text style={styles.outcomeButtonText}>
              {outcome.ok ? "Diak" : "Koko fila fali"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  outcomeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  outcomeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#001F54",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  outcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  outcomeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0b1b3d",
    textAlign: "center",
  },
  outcomeMessage: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#44526b",
    textAlign: "center",
  },
  outcomeButton: {
    marginTop: 20,
    alignSelf: "stretch",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  /* ---------------------------------------------------------------- *
   * Confirmation step
   *
   * A flex column with one growing row. Everything but the photo has a
   * fixed height, so the photo absorbs the slack and the screen fits on
   * any phone without scrolling.
   * ---------------------------------------------------------------- */
  previewScreen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  previewHeader: {
    alignItems: "center",
    paddingTop: 12,
    rowGap: 2,
  },
  previewName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0b1b3d",
  },
  previewId: {
    fontSize: 15,
    color: "#8A94A6",
    fontWeight: "500",
  },
  photoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  previewImage: {
    height: "100%",
    aspectRatio: 3 / 4,
    // Keeps the photo sane on tall screens; the flex parent handles short ones.
    maxHeight: 320,
    borderRadius: 20,
    backgroundColor: "#EEF2F7",
    shadowColor: "#001F54",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  statusCard: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E9F0",
    borderRadius: 16,
    backgroundColor: "#FAFBFD",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sesaunLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#8A94A6",
  },
  asaunRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 4,
  },
  asaunText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#007AFF",
  },
  statusSeparator: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: "#E5E9F0",
    marginVertical: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 6,
  },
  statusTime: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0b1b3d",
    // Stops the row twitching as the seconds tick.
    fontVariant: ["tabular-nums"],
  },
  statusZone: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8A94A6",
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
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 10,
    marginTop: 16,
    height: 52,
    backgroundColor: "#007AFF",
    borderRadius: 12,
  },
  previewButtonBusy: {
    opacity: 0.6,
  },
  previewError: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#B45309",
  },
  previewButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
});
