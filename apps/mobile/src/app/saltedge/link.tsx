import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type } from '../../components/ui';
import { resolveSaltEdge } from '../../lib/bank-link-saltedge';
import { useTheme } from '../../theme';

// Full-screen host for the Salt Edge Connect widget. The widget performs
// provider selection and bank OAuth inside this WebView; the app only
// intercepts the final return URL and the widget's saltbridge:// stage links.
export default function SaltEdgeLink() {
  const params = useLocalSearchParams<{ url: string; returnUrl: string; sessionId: string }>();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Defer past Strict Mode's effect replay; a real pop/unmount cancels.
      queueMicrotask(() => {
        if (!mounted.current && params.sessionId) resolveSaltEdge(null, params.sessionId);
      });
    };
  }, [params.sessionId]);
  const connectUrl = decodeURIComponent(String(params.url ?? ''));
  const returnUrl = String(params.returnUrl ?? '');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const expected = (() => {
    try {
      return new URL(returnUrl);
    } catch {
      return null;
    }
  })();
  function finish(outcome: string | null) {
    resolveSaltEdge(outcome, params.sessionId);
    if (router.canGoBack()) router.back();
  }
  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Type variant="headline" style={{ flex: 1 }}>
          Connect your bank
        </Type>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel bank connection"
          onPress={() => finish(null)}
        >
          <Type muted>Cancel</Type>
        </Pressable>
      </View>
      <View style={styles.web}>
        <WebView
          source={{ uri: connectUrl }}
          incognito
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => {
            if (!expected) return true;
            let target: URL | null = null;
            try {
              target = new URL(request.url);
            } catch {
              return false;
            }
            if (
              target.protocol === expected.protocol &&
              target.host === expected.host &&
              target.pathname === expected.pathname
            ) {
              finish('');
              return false;
            }
            // Stage events arrive via postMessage; the bridge links stay unloaded.
            if (target.protocol === 'saltbridge:') return false;
            return true;
          }}
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.muted} />
            </View>
          )}
          startInLoadingState
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  bar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  web: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
