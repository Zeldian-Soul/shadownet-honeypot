import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* This tells the router to simply load your index.tsx file */}
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}