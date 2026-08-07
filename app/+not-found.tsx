import { Stack } from "expo-router";
import { Text, View } from "react-native";


export default function NotFound() {
    return (
        <>
            <Stack.Screen options={{ title: "Not Found!" }} />
            <View>
                <Text>Screen la iha!</Text>
            </View>
        </>
    )
}