declare module 'react-native-qrcode-styled' {
  import type { ComponentType } from 'react';
  import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

  type Props = {
    data: string;
    color?: ColorValue;
    style?: StyleProp<ViewStyle>;
    padding?: number;
    pieceSize?: number;
    pieceBorderRadius?: number | number[];
    isPiecesGlued?: boolean;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };

  const QRCodeStyled: ComponentType<Props>;
  export default QRCodeStyled;
}
