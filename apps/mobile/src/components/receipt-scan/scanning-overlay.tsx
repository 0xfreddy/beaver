import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { OnboardingAnimation } from '../onboarding-animation';
import { Type } from '../ui';

function Corner({ placement }: { placement: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.corner,
        placement === 'tl' && styles.cornerTopLeft,
        placement === 'tr' && styles.cornerTopRight,
        placement === 'bl' && styles.cornerBottomLeft,
        placement === 'br' && styles.cornerBottomRight,
      ]}
    />
  );
}

/**
 * The AI-detection state of the scan flow: the receipt photo fills its scanning
 * viewport inside white corner brackets on the app's black background, while
 * the bundled receipt-scanner animation plays beneath it.
 */
export function ScanningOverlay({
  image,
  label = 'Scanning your receipt…',
}: {
  image: string;
  label?: string;
}) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - 48, 380);
  const frameHeight = Math.min(height * 0.46, 480);
  // Sized against both axes so the whole stack (photo, animation, caption)
  // always fits the screen.
  const scannerSize = Math.min(width * 0.58, height * 0.26, 260);

  return (
    <View style={styles.backdrop} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <View style={styles.stack}>
        <View style={{ width: frameWidth, height: frameHeight }}>
          <View style={styles.photoClip}>
            <Image source={{ uri: image }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          </View>
          <Corner placement="tl" />
          <Corner placement="tr" />
          <Corner placement="bl" />
          <Corner placement="br" />
        </View>
        <View style={{ width: scannerSize, height: scannerSize }}>
          {/* The scan screen stays dark regardless of the app theme. */}
          <OnboardingAnimation
            name="receipt-scanner"
            height={scannerSize}
            loop
            backgroundColor="#000000"
            foregroundColor="#FFFFFF"
          />
        </View>
        <View style={styles.caption}>
          <Type style={styles.captionTitle}>{label}</Type>
          <Type style={styles.captionDetail}>Beaver AI is reading the details</Type>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', gap: 22 },
  photoClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#000000',
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: -9,
    left: -9,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 10,
  },
  cornerTopRight: {
    top: -9,
    right: -9,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 10,
  },
  cornerBottomLeft: {
    bottom: -9,
    left: -9,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 10,
  },
  cornerBottomRight: {
    bottom: -9,
    right: -9,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 10,
  },
  caption: { alignItems: 'center', gap: 6 },
  captionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  captionDetail: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
});
