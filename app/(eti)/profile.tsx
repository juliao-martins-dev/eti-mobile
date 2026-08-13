import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ISTORIA_COLORS } from "@/components/IstoriaSummary";
import { ReminderDiagnosticsPanel } from "@/components/ReminderDiagnostics";
import { apiErrorMessage } from "@/lib/api";
import {
  displayName,
  fetchMe,
  getCachedUser,
  logout,
  photoUrl,
  roleLabel,
  staffNumber,
  updateProfilePhoto,
  userField,
} from "@/lib/auth";
import {
  fetchKonfig,
  KONFIG_FALLBACK,
  trimSeconds,
  type Konfig,
} from "@/lib/konfig";
import type { AuthUser } from "@/lib/storage";

const placehoderImage = require("@/assets/images/default.jpg");

/**
 * How close to the end counts as "the bottom", in points.
 *
 * The two copies of the button are identical and land in the same place at
 * full scroll, so the hand-off only needs to happen once they have all but
 * converged — small enough that nothing visibly moves.
 */
const NEAR_BOTTOM = 12;

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [konfig, setKonfig] = useState<Konfig>(KONFIG_FALLBACK);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  // The pinned copy is only needed while the inline one is out of reach.
  const [atBottom, setAtBottom] = useState(false);
  const pinnedOpacity = useRef(new Animated.Value(1)).current;

  // Kept in refs because all three arrive from different callbacks and none
  // of them should trigger a render on its own.
  const offsetY = useRef(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);

  const evaluatePosition = useCallback(() => {
    const scrollable = contentHeight.current - viewportHeight.current;

    // Content shorter than the screen never scrolls, so it is already at the
    // end — without this the pinned copy would sit there forever.
    setAtBottom(
      scrollable <= 0 || offsetY.current >= scrollable - NEAR_BOTTOM,
    );
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

      offsetY.current = contentOffset.y;
      viewportHeight.current = layoutMeasurement.height;
      contentHeight.current = contentSize.height;
      evaluatePosition();
    },
    [evaluatePosition],
  );

  useEffect(() => {
    Animated.timing(pinnedOpacity, {
      toValue: atBottom ? 0 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [atBottom, pinnedOpacity]);

  useEffect(() => {
    let isMounted = true;

    // Paint from cache first, then refresh from /api/auth/me/.
    getCachedUser().then((cached) => {
      if (isMounted && cached) setUser(cached);
    });

    fetchMe()
      .then((profile) => {
        if (isMounted) setUser(profile);
      })
      .catch(() => {
        // 401 is handled by the interceptor; otherwise keep the cached profile.
      });

    // The work schedule belongs to the server, not to a literal in this file.
    fetchKonfig().then((value) => {
      if (isMounted) setKonfig(value);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePickPhoto = async () => {
    if (isUploadingPhoto) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Presiza asesu ba galeria atu troka foto perfil.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return;

    setIsUploadingPhoto(true);

    try {
      const updated = await updateProfilePhoto(asset.uri);
      setUser(updated);
    } catch (e) {
      alert(apiErrorMessage(e, "Falla troka foto perfil!"));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    await logout();
    router.replace("/(auth)");
  };

  // Every row below is a field /api/auth/me/ actually returns.
  const name = displayName(user, "-");
  const position = userField(user, ["kargu"], "-");
  const email = userField(user, ["email"], "-");
  const numeruId = staffNumber(user);
  const role = roleLabel(user, "-");

  const remotePhoto = photoUrl(user);
  const avatarSource = remotePhoto ? { uri: remotePhoto } : placehoderImage;

  // Schedule and geofence come from /api/konfig/.
  const dader = `${trimSeconds(konfig.oras_dader_tama)} – ${trimSeconds(konfig.oras_dader_fila)}`;
  const lorokraik = `${trimSeconds(konfig.oras_lorokraik_tama)} – ${trimSeconds(konfig.oras_lorokraik_fila)}`;
  const raiu = `${Math.round(konfig.eskola_raiu_metru)} metru`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          evaluatePosition();
        }}
        onContentSizeChange={(_width, height) => {
          contentHeight.current = height;
          evaluatePosition();
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Profile Image */}
        <View style={styles.imageSection}>
          <View style={styles.imageWrapper}>
            <Image source={avatarSource} style={styles.profileImage} />
            <Pressable
              style={styles.cameraButton}
              onPress={handlePickPhoto}
              disabled={isUploadingPhoto}
            >
              <Feather name="camera" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.position}>{position}</Text>
        </View>

        <InfoCard
          title="Informasaun Pessoal"
          rows={[
            ["Naran", name],
            ["Numeru ID", numeruId],
            ["Kargu", position],
            ["Email", email],
            ["Tipu konta", role],
          ]}
        />

        <InfoCard
          title="Informasaun Servisu"
          rows={[
            ["Horariu Dader", dader],
            ["Horariu Lorokraik", lorokraik],
            ["Raiu eskola", raiu],
          ]}
          onLongPressTitle={() => setDiagnosticsOpen(true)}
        />

        {/* The real button, at the end of the content where it belongs. */}
        <View style={[styles.footerBar, styles.footerInline]}>
          <LogoutButton onPress={handleLogout} disabled={isLoggingOut} />
        </View>
      </ScrollView>

      <ReminderDiagnosticsPanel
        visible={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
      />

      {/*
        A second copy pinned to the bottom, covering the inline one until it
        scrolls into view. Both are identical and coincide at full scroll, so
        the cross-fade reads as the footer simply settling into the page.
        pointerEvents is dropped with the opacity, otherwise the invisible
        copy would keep swallowing taps meant for the inline one.
      */}
      <Animated.View
        pointerEvents={atBottom ? "none" : "auto"}
        style={[styles.footerBar, styles.footerPinned, { opacity: pinnedOpacity }]}
      >
        <LogoutButton onPress={handleLogout} disabled={isLoggingOut} />
      </Animated.View>
    </SafeAreaView>
  );
}

/**
 * Rendered twice — inline and pinned — so the two copies can never drift
 * apart. Anything less than an exact match would show up as a jump during
 * the cross-fade.
 */
function LogoutButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable style={styles.logoutButton} onPress={onPress} disabled={disabled}>
      <Feather name="log-out" size={20} color="#fff" />
      <Text style={styles.logoutText}>Sai (logout)</Text>
    </Pressable>
  );
}

/**
 * A titled group of label/value rows.
 *
 * Rows are separated by hairlines rather than gaps, so the card reads as one
 * table instead of a stack of loose lines, and the title sits as a quiet
 * eyebrow — it names the group without competing with the values.
 */
function InfoCard({
  title,
  rows,
  onLongPressTitle,
}: {
  title: string;
  rows: [label: string, value: string][];
  /** Undocumented on purpose: the diagnostics are for whoever maintains this. */
  onLongPressTitle?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text
        style={styles.cardTitle}
        onLongPress={onLongPressTitle}
        suppressHighlighting
      >
        {title}
      </Text>

      {rows.map(([label, value], index) => (
        <View
          key={label}
          style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
        >
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    // Deliberately no horizontal padding: React Native offsets absolutely
    // positioned children by their parent's padding, which would make the
    // pinned footer's left/right of 0 land 16pt inside the screen. The
    // padding lives on the scroll content instead.
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  imageSection: {
    alignItems: "center",
    marginVertical: 24,
  },
  imageWrapper: {
    position: "relative",
  },
  cameraButton: {
    position: "absolute",
    right: 0,
    // Clears the 12px marginBottom on the image so the icon sits on its edge.
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    // Once either of these wraps, the Text fills the width and its later
    // lines would sit left of the avatar without this.
    textAlign: "center",
  },
  position: {
    fontSize: 16,
    color: "#555",
    marginTop: 4,
    textAlign: "center",
    // Keeps a wrapped kargu off the screen edges.
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: ISTORIA_COLORS.card,
    borderWidth: 1,
    borderColor: ISTORIA_COLORS.track,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: ISTORIA_COLORS.subtle,
    paddingTop: 16,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    // A value that wraps aligns its first line with the label rather than
    // centring against it.
    alignItems: "flex-start",
    // Guarantees a gap: with space-between alone, a long value runs straight
    // into the label once it fills the row.
    columnGap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  label: {
    fontSize: 14,
    color: ISTORIA_COLORS.subtle,
    // The label is a fixed string; the value is the part that gives way.
    flexShrink: 0,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: ISTORIA_COLORS.text,
    // Bounded by the row, so a long kargu wraps inside the card instead of
    // overflowing it. Short values are unchanged -- still flush right.
    flex: 1,
    textAlign: "right",
    // Times and ID numbers line up column-wise between the two cards.
    fontVariant: ["tabular-nums"],
  },
  // Shared by both copies. Any difference here would show as a jump when one
  // fades into the other.
  footerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Opaque and same as the screen: cards scrolling under it stay hidden.
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: ISTORIA_COLORS.track,
  },
  footerInline: {
    // Cancels the scroll content's 16pt padding so the border runs edge to
    // edge, exactly like the pinned copy above it.
    marginHorizontal: -16,
  },
  footerPinned: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    columnGap: 8,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
