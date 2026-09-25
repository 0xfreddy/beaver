import { Platform, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

const symbols = {
  back: { name: 'arrow.left', fallback: '←' },
  next: { name: 'arrow.right', fallback: '→' },
  coffee: { name: 'cup.and.saucer', fallback: 'C' },
  check: { name: 'checkmark', fallback: '✓' },
  copy: { name: 'doc.on.doc', fallback: '⧉' },
  lock: { name: 'lock', fallback: '·' },
  calendar: { name: 'calendar', fallback: '□' },
  fingerprint: { name: 'touchid', fallback: '◎' },
  repeat: { name: 'arrow.triangle.2.circlepath', fallback: '↻' },
  eye: { name: 'eye', fallback: 'O' },
  briefcase: { name: 'briefcase.fill', fallback: '▣' },
  savings: { name: 'dollarsign.circle', fallback: '$' },
  trendDown: { name: 'chart.line.downtrend.xyaxis', fallback: '↓' },
  trendUp: { name: 'chart.line.uptrend.xyaxis', fallback: '↑' },
  table: { name: 'tablecells', fallback: '▦' },
  hourglass: { name: 'hourglass', fallback: '⌛' },
  message: { name: 'bubble.left.fill', fallback: '●' },
  system: { name: 'iphone', fallback: '□' },
  sun: { name: 'sun.max', fallback: '○' },
  moon: { name: 'moon', fallback: '◐' },
  play: { name: 'play.fill', fallback: '▶' },
  search: { name: 'magnifyingglass', fallback: '⌕' },
  close: { name: 'xmark', fallback: '×' },
  qr: { name: 'qrcode', fallback: '▦' },
  edit: { name: 'pencil', fallback: '✎' },
  card: { name: 'creditcard', fallback: '▤' },
  chevronDown: { name: 'chevron.down', fallback: '⌄' },
  photo: { name: 'photo', fallback: '◧' },
  camera: { name: 'camera.fill', fallback: '◉' },
  flash: { name: 'bolt.fill', fallback: '⚡' },
  flashOff: { name: 'bolt.slash.fill', fallback: '⊘' },
  plus: { name: 'plus', fallback: '+' },
  minus: { name: 'minus', fallback: '−' },
  trash: { name: 'trash.fill', fallback: '⌫' },
  history: { name: 'clock.arrow.circlepath', fallback: '◷' },
} as const;

export function AppSymbol({
  name,
  color,
  size = 20,
}: {
  name: keyof typeof symbols;
  color: string;
  size?: number;
}) {
  const symbol = symbols[name];
  if (Platform.OS === 'ios')
    return (
      <SymbolView
        name={symbol.name}
        tintColor={color}
        size={size}
        style={{ width: size, height: size }}
      />
    );
  return (
    <Text aria-hidden style={{ color, fontSize: size, lineHeight: size + 4 }}>
      {symbol.fallback}
    </Text>
  );
}
