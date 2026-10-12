import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { SetupPage } from '../../components/setup-page';
import { OnboardingAnimation } from '../../components/onboarding-animation';
import { Button, TextButton, Type } from '../../components/ui';
import { resolveSaltEdge } from '../../lib/bank-link-saltedge';
import { parseWidgetCompletion } from '../../lib/bank-connect-state';
import { useTheme } from '../../theme';

// Full-screen host for the Salt Edge Connect widget. The widget performs
// provider selection and bank OAuth inside this WebView; the app only
// intercepts the final return URL, the widget's postMessage completion, and
// the saltbridge:// stage links.
export default function SaltEdgeLink() {
  const params = useLocalSearchParams<{
    url: string;
    returnUrl: string;
    sessionId: string;
  }>();
  const mounted = useRef(false);
  const finished = useRef(false);
  const pageUrl = useRef('');
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'slow' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    if (loadState !== 'loading') return;
    const timer = setTimeout(() => setLoadState('slow'), 15_000);
    return () => clearTimeout(timer);
  }, [loadState, attempt]);
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
  const { colors } = useTheme();
  const expected = (() => {
    try {
      return new URL(returnUrl);
    } catch {
      return null;
    }
  })();
  function finish(outcome: string | null) {
    if (finished.current) return;
    finished.current = true;
    resolveSaltEdge(outcome, params.sessionId);
    if (router.canGoBack()) router.back();
    else router.replace('/settings/banks');
  }
  return (
    <View
      onAccessibilityEscape={() => finish(null)}
      style={[styles.page, { backgroundColor: colors.background }]}
    >
      <View style={styles.web}>
        <WebView
          key={attempt}
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
          // The widget's postMessage completion is the primary in-WebView
          // signal; the return URL and the deep link remain as fallbacks.
          onMessage={(event) => {
            if (parseWidgetCompletion(event.nativeEvent.data)) finish('');
          }}
          onLoadStart={(event) => {
            pageUrl.current = event.nativeEvent.url;
            setLoadState('loading');
          }}
          onLoad={() => setLoadState((current) => (current === 'failed' ? current : 'ready'))}
          onError={() => setLoadState('failed')}
          onHttpError={(event) => {
            if (event.nativeEvent.url === pageUrl.current) setLoadState('failed');
          }}
          onContentProcessDidTerminate={() => setLoadState('failed')}
          renderError={() => <View />}
        />
        {loadState !== 'ready' ? (
          <View style={StyleSheet.absoluteFill} accessibilityLiveRegion="polite">
            <SetupPage
              animateTitle={false}
              includeTopSafeArea
              contentStyle={{ flex: 1, justifyContent: 'center' }}
              title={loadState === 'failed' ? 'Connection unavailable' : 'Connect your bank'}
              actions={
                <>
                  <View style={styles.status}>
                    {loadState === 'loading' ? <ActivityIndicator color={colors.muted} /> : null}
                    <Type muted style={{ flex: 1 }}>
                      {loadState === 'failed'
                        ? 'Check your connection and try again.'
                        : loadState === 'slow'
                          ? 'Taking longer than expected. Keep waiting or try again.'
                          : 'Opening your secure connection…'}
                    </Type>
                  </View>
                  {loadState !== 'loading' ? (
                    <Button
                      appearance="onboarding"
                      title="Try again"
                      onPress={() => {
                        setLoadState('loading');
                        setAttempt((value) => value + 1);
                      }}
                    />
                  ) : null}
                  <TextButton title="Back" onPress={() => finish(null)} />
                </>
              }
            >
              <OnboardingAnimation name="bank-bridge-builder" height={300} loop={false} />
            </SetupPage>
          </View>
        ) : null}
      </View>
      {loadState === 'ready' ? (
        <View style={{ paddingHorizontal: 28, paddingBottom: 20 }}>
          <TextButton title="Back" onPress={() => finish(null)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  web: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
