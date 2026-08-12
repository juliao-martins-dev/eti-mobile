import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

const placehoderImage = require("@/assets/images/prof.jpg");

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [konfig, setKonfig] = useState<Konfig>(KONFIG_FALLBACK);

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
      <ScrollView showsVerticalScrollIndicator={false}>
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

        {/* Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasaun Pessoal</Text>

          <ProfileRow label="Naran" value={name} />
          <ProfileRow label="Numeru ID" value={numeruId} />
          <ProfileRow label="Kargu" value={position} />
          <ProfileRow label="Email" value={email} />
          <ProfileRow label="Tipu konta" value={role} />
        </View>

        {/* Work Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasaun Servisu</Text>

          <ProfileRow label="Horariu Dader" value={dader} />
          <ProfileRow label="Horariu Lorokraik" value={lorokraik} />
          <ProfileRow label="Raiu eskola" value={raiu} />
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <Feather name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Small reusable row */
function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    backgroundColor: "#f9f9f9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
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
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    color: "#555",
    // The label is a fixed string; the value is the part that gives way.
    flexShrink: 0,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    // Bounded by the row, so a long kargu wraps inside the card instead of
    // overflowing it. Short values are unchanged -- still flush right.
    flex: 1,
    textAlign: "right",
  },
  actionContainer: {
    marginVertical: 24,
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
