import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

export default function LoadingBar() {
  const translateX = useSharedValue(-60);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(60, { duration: 900 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 24,
  },
  bar: {
    width: 70,
    height: 6,
    backgroundColor: "#007AFF",
    borderRadius: 3,
  },
});
