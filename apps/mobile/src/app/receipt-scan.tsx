import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Camera from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../providers/auth-provider';
import { useLive, type Balances } from '../lib/live';
import { apiRequest } from '../lib/api';
import { localReceiptDate } from '../lib/receipt-date';
import { setReceiptScanDraft, type ReceiptLineItem } from '../lib/receipt-scan-session';
import { AppSymbol } from '../components/app-symbol';
import { Type } from '../components/ui';
import { ScanningOverlay } from '../components/receipt-scan/scanning-overlay';

type Extraction = {
  merchant: string | null;
  total: string | null;
  date: string | null;
  currency: string | null;
  usdCents?: number | null;
  category?: string | null;
  paymentMethod?: string | null;
  subtotal?: string | null;
  tax?: string | null;
  items?: ReceiptLineItem[] | null;
};

type Phase = 'camera' | 'scanning';

function BracketCorner({ placement }: { placement: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.bracket,
        placement === 'tl' && styles.bracketTopLeft,
        placement === 'tr' && styles.bracketTopRight,
        placement === 'bl' && styles.bracketBottomLeft,
        placement === 'br' && styles.bracketBottomRight,
      ]}
    />
  );
}

/** Manual mode entry: the camera opens directly; a Gallery button picks a saved photo. */
export default function ReceiptScan() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('camera');
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const camera = useRef<Camera.CameraView>(null);
  const key = useRef(Crypto.randomUUID());
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const balances = useLive<Balances>('/v1/trading/balances', true, false);
  const capabilities = useLive<{ scanEnabled: boolean; photosEnabled: boolean }>(
    '/v1/manual/receipts',
    true,
    false,
  );
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => () => abort.current?.abort(), []);

  const checkFunds = useCallback(async () => {
    const result = await balances.refetch();
    if (result.error || !result.data)
      throw result.error ?? new Error('Could not check your balance. Please try again.');
    if (BigInt(result.data.availableUsdcRaw) <= 0n)
      throw new Error('Add enough USDC to cover your roundup before adding this receipt.');
  }, [balances]);

  const runScan = useCallback(
    async (image: string) => {
      if (image.length > 2800000) {
        setError('Crop closer to the receipt and try again. The photo is too large.');
        return;
      }
      setScanImage(image);
      setPhase('scanning');
      setError(null);
      const controller = new AbortController();
      abort.current = controller;
      try {
        await checkFunds();
        const created = await apiRequest<{ id: string; transactionId: string | null }>(
          auth.getAccessToken,
          '/v1/manual/receipts',
          {
            method: 'POST',
            headers: { 'Idempotency-Key': key.current },
            signal: controller.signal,
            // Storage availability must not prevent scanning a local receipt.
            body: JSON.stringify({
              image: capabilities.data?.photosEnabled === false ? null : image,
            }),
          },
        );
        if (created.transactionId)
          throw new Error('This receipt has already been confirmed. It is saved in your receipts.');
        let extraction: Extraction | null = null;
        if (capabilities.data?.scanEnabled) {
          extraction = await apiRequest<Extraction>(
            auth.getAccessToken,
            `/v1/manual/receipts/${created.id}/scan`,
            {
              method: 'POST',
              signal: controller.signal,
              body: JSON.stringify({ aiConsent: true }),
            },
          );
        }
        if (controller.signal.aborted) return;
        setReceiptScanDraft({
          receiptId: created.id,
          image,
          merchant: extraction?.merchant ?? '',
          total: extraction?.total ?? '',
          date: extraction?.date ?? localReceiptDate(new Date()),
          currency:
            extraction?.currency && extraction.currency !== 'USD'
              ? extraction.currency
              : (extraction?.currency ?? 'USD'),
          usdCents: extraction?.usdCents ?? null,
          category: extraction?.category ?? null,
          paymentMethod: extraction?.paymentMethod ?? null,
          subtotal: extraction?.subtotal ?? null,
          tax: extraction?.tax ?? null,
          items: extraction?.items ?? null,
        });
        key.current = Crypto.randomUUID();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/receipt-review');
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Please try again.');
        setPhase('camera');
      } finally {
        if (abort.current === controller) abort.current = null;
      }
    },
    [auth.getAccessToken, capabilities.data, checkFunds],
  );

  async function takePhoto() {
    if (busy.current || !camera.current) return;
    busy.current = true;
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.45, base64: true });
      const base64 = shot?.base64;
      if (!base64) throw new Error('Could not read this photo. Try again.');
      await runScan(`data:image/jpeg;base64,${base64}`);
    } catch (cause) {
      if (!abort.current?.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The photo could not be captured. Try again or pick one from Gallery.',
        );
      setPhase('camera');
    } finally {
      busy.current = false;
    }
  }

  async function pickFromGallery() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const permissionCheck = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionCheck.granted && !permissionCheck.canAskAgain) {
        setError('Allow photo access in Settings, then try again.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.45,
        allowsEditing: true,
      });
      if (result.canceled) return;
      const base64 = result.assets[0]?.base64;
      if (!base64) throw new Error('Could not read this photo. Try a JPEG receipt photo.');
      await runScan(`data:image/jpeg;base64,${base64}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
      setPhase('camera');
    } finally {
      busy.current = false;
    }
  }

  function cancelScan() {
    abort.current?.abort();
    abort.current = null;
    setPhase('camera');
    setError(null);
  }

  const funded = !!balances.data && BigInt(balances.data.availableUsdcRaw) > 0n;
  const gateReady = !balances.isPending;
  const cameraReady = !!permission?.granted;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      {phase === 'scanning' && scanImage ? (
        <>
          <ScanningOverlay image={scanImage} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel scan"
            onPress={cancelScan}
            style={[styles.topButton, styles.cancelScan, { top: insets.top + 10 }]}
          >
            <AppSymbol name="close" color="#FFFFFF" size={18} />
          </Pressable>
        </>
      ) : !gateReady || (!funded && !balances.error) ? (
        <View
          style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        >
          <Type variant="headline" style={styles.gateTitle}>
            {balances.isPending ? 'Checking your balance…' : 'Add balance first'}
          </Type>
          <Type style={styles.gateBody}>
            {balances.isPending
              ? 'One moment while your wallet is checked.'
              : 'Your roundups use USDC from your wallet. Add balance before recording a purchase.'}
          </Type>
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            {!balances.isPending ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/funding')}
                style={({ pressed }) => [styles.gatePrimary, { opacity: pressed ? 0.82 : 1 }]}
              >
                <Type style={styles.gatePrimaryLabel}>Add balance</Type>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.gateSecondary, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Type style={styles.gateSecondaryLabel}>Not now</Type>
            </Pressable>
          </View>
        </View>
      ) : balances.error ? (
        <View
          style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        >
          <Type variant="headline" style={styles.gateTitle}>
            Check your wallet balance
          </Type>
          <Type style={styles.gateBody}>
            Your balance could not be refreshed. Try again before adding a receipt.
          </Type>
          <Pressable
            accessibilityRole="button"
            onPress={() => void balances.refetch()}
            style={({ pressed }) => [styles.gatePrimary, { opacity: pressed ? 0.82 : 1 }]}
          >
            <Type style={styles.gatePrimaryLabel}>Try again</Type>
          </Pressable>
        </View>
      ) : !cameraReady ? (
        <View
          style={[styles.gate, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        >
          <AppSymbol name="camera" color="#FFFFFF" size={40} />
          <Type variant="headline" style={styles.gateTitle}>
            Camera access
          </Type>
          <Type style={styles.gateBody}>
            {permission?.canAskAgain === false
              ? 'Allow camera access in Settings to scan receipts, or choose a photo from your gallery.'
              : 'Allow camera access to scan your receipts.'}
          </Type>
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            {permission?.canAskAgain === false ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => Linking.openSettings()}
                style={({ pressed }) => [styles.gatePrimary, { opacity: pressed ? 0.82 : 1 }]}
              >
                <Type style={styles.gatePrimaryLabel}>Open Settings</Type>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickFromGallery()}
              style={({ pressed }) => [styles.gateSecondary, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Type style={styles.gateSecondaryLabel}>Choose from gallery</Type>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Camera.CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash ? 'on' : 'off'}
            enableTorch={flash}
          />
          <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
            <LinearGradient
              colors={['rgba(4,6,12,0.62)', 'rgba(4,6,12,0)']}
              style={styles.topShade}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(4,6,12,0)', 'rgba(4,6,12,0.72)']}
              style={styles.bottomShade}
              pointerEvents="none"
            />
            <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close camera"
                onPress={() => router.back()}
                style={styles.topButton}
              >
                <AppSymbol name="close" color="#FFFFFF" size={18} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Saved receipts"
                onPress={() => router.push('/settings/manual')}
                style={styles.topButton}
              >
                <AppSymbol name="history" color="#FFFFFF" size={19} />
              </Pressable>
            </View>
            <View style={[styles.hintFrame, { width: width * 0.76, height: height * 0.56 }]}>
              <BracketCorner placement="tl" />
              <BracketCorner placement="tr" />
              <BracketCorner placement="bl" />
              <BracketCorner placement="br" />
            </View>
            <Type style={styles.hintTitle}>Scan &amp; Add Your Receipt!</Type>
            <View
              style={[styles.controls, { paddingBottom: insets.bottom + 18 }]}
              pointerEvents="box-none"
            >
              {error ? (
                <View style={styles.errorPill} accessibilityRole="alert">
                  <Type style={styles.errorText}>{error}</Type>
                </View>
              ) : null}
              <View style={styles.controlsRow} pointerEvents="box-none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gallery"
                  onPress={() => void pickFromGallery()}
                  style={({ pressed }) => [styles.galleryButton, { opacity: pressed ? 0.72 : 1 }]}
                >
                  <AppSymbol name="photo" color="#FFFFFF" size={18} />
                  <Type style={styles.galleryLabel}>Gallery</Type>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                  onPress={() => void takePhoto()}
                  style={({ pressed }) => [
                    styles.shutter,
                    { transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={flash ? 'Turn off flash' : 'Turn on flash'}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setFlash((value) => !value);
                  }}
                  style={[styles.topButton, styles.flashButton]}
                >
                  <AppSymbol name={flash ? 'flash' : 'flashOff'} color="#FFFFFF" size={18} />
                </Pressable>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  overlay: { backgroundColor: 'transparent' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 190 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
  },
  flashButton: { backgroundColor: 'rgba(0,0,0,0.55)' },
  cancelScan: { position: 'absolute', top: 0, left: 20 },
  hintFrame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '22%',
  },
  hintTitle: {
    position: 'absolute',
    alignSelf: 'center',
    top: '15.5%',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 8,
  },
  bracket: { position: 'absolute', width: 34, height: 34, borderColor: '#FFFFFF' },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, gap: 16 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 18,
    paddingRight: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
  },
  galleryLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  errorPill: {
    alignSelf: 'center',
    maxWidth: '88%',
    backgroundColor: 'rgba(22,12,10,0.86)',
    borderColor: 'rgba(215,143,131,0.55)',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { color: '#FFECE8', fontSize: 14, textAlign: 'center' },
  gate: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
  },
  gateTitle: { color: '#FFFFFF', textAlign: 'center' },
  gateBody: { color: 'rgba(255,255,255,0.65)', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  gatePrimary: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  gatePrimaryLabel: { color: '#101423', fontSize: 16, fontWeight: '600' },
  gateSecondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  gateSecondaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },
});
