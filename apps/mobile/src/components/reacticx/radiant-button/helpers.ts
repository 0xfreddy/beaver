export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.4, 0.9, 0.98];
  const [, red = '00', green = '00', blue = '00'] = result;
  return [
    Number.parseInt(red, 16) / 255,
    Number.parseInt(green, 16) / 255,
    Number.parseInt(blue, 16) / 255,
  ];
}

export function createDotShaderSource(
  spacing: number,
  dotRadius: number,
  opacity: number,
  useDarkDots: boolean,
) {
  return `
    uniform float2 iResolution;
    uniform float angle;

    half4 main(float2 fragCoord) {
      float spacing = ${spacing.toFixed(1)};
      float dotR = ${dotRadius.toFixed(2)};
      float2 grid = mod(fragCoord, spacing);
      float d = length(grid - float2(spacing * 0.5, spacing * 0.5));
      float dot = 1.0 - smoothstep(dotR - 0.3, dotR + 0.1, d);

      float2 center = iResolution * 0.5;
      float2 dir = fragCoord - center;
      float a = atan(dir.y, dir.x);
      float norm = (a + 3.14159265) / 6.28318530;
      float rot = fract(norm - angle / 6.28318530 - 0.125);
      float mask = (1.0 - smoothstep(0.0, 0.12, rot))
        + smoothstep(0.88, 1.0, rot);

      return half4(${useDarkDots ? '0.0, 0.0, 0.0' : '1.0, 1.0, 1.0'}, dot * mask * ${opacity.toFixed(2)});
    }
  `;
}
