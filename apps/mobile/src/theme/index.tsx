import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 };
const light = {
  background: '#F7F7F7',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#686868',
  line: '#DEDEDE',
  accent: '#1A1A1A',
  accentInk: '#FFFFFF',
  green: '#1A1A1A',
  danger: '#9F4238',
  soft: '#EBEBEB',
  glass: 'rgba(255,255,255,0.84)',
};
const dark = {
  background: '#000000',
  surface: '#141414',
  ink: '#F5F5F5',
  muted: '#A3A3A3',
  line: '#303030',
  accent: '#242424',
  accentInk: '#FFFFFF',
  green: '#F5F5F5',
  danger: '#D78F83',
  soft: '#1A1A1A',
  glass: 'rgba(24,24,24,0.90)',
};
export type ThemeChoice = 'system' | 'light' | 'dark';
type Theme = {
  colors: typeof light;
  isDark: boolean;
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
};
const Context = createContext<Theme | null>(null);
export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [choice, setChoice] = useState<ThemeChoice>('dark');
  useEffect(() => {
    if (Platform.OS !== 'web')
      Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
  }, [choice]);
  const isDark = (choice === 'system' ? system : choice) === 'dark';
  return (
    <Context.Provider value={{ colors: isDark ? dark : light, isDark, choice, setChoice }}>
      {children}
    </Context.Provider>
  );
}
export function useTheme() {
  const theme = useContext(Context);
  if (!theme) throw new Error('ThemeProvider is missing');
  return theme;
}
