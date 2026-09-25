import { Stack, router } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import { Type } from '../../components/ui';
import { useTheme } from '../../theme';

export default function ActivityLayout() {
  const { colors, isDark } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
        statusBarStyle: isDark ? 'light' : 'dark',
        scrollEdgeEffects: { top: 'soft', bottom: 'automatic', left: 'hidden', right: 'hidden' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerShown: Platform.OS !== 'ios',
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              style={{ padding: 12 }}
            >
              <Type>Done</Type>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="transaction/[id]"
        options={{
          title: '',
          headerShown: Platform.OS !== 'ios',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92, 1],
          sheetGrabberVisible: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              style={{ padding: 12 }}
            >
              <Type>Done</Type>
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
