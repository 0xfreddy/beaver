import { Component, useState } from 'react';
import type { ErrorInfo, PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, useTheme } from '../theme';
import { Button, Type } from '../components/ui';
import { AutoActivateInvesting } from '../components/auto-activate-investing';
import { OnboardingProvider } from './onboarding-provider';
import { ProfileProvider } from './profile-provider';
import { AuthProvider } from './auth-provider';
import { OnchainPreviewProvider } from './onchain-preview-provider';
import { MockDataProvider } from './mock-data-provider';

class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  override render() {
    if (this.state.failed)
      return <ErrorFallback onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        padding: 28,
        gap: 16,
      }}
    >
      <Type variant="title">Let’s try that again.</Type>
      <Type muted>Beaver encountered a problem.</Type>
      <Button title="Reload this screen" onPress={onRetry} />
    </View>
  );
}
function NavigationTheme({ children }: PropsWithChildren) {
  const { isDark, colors } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.ink,
          primary: colors.green,
          border: colors.line,
        },
      }}
    >
      {children}
    </NavigationThemeProvider>
  );
}
export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: 1 } } }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <OnboardingProvider>
                  <AutoActivateInvesting />
                  <MockDataProvider>
                    <OnchainPreviewProvider>
                      <ProfileProvider>
                        <NavigationTheme>{children}</NavigationTheme>
                      </ProfileProvider>
                    </OnchainPreviewProvider>
                  </MockDataProvider>
                </OnboardingProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
