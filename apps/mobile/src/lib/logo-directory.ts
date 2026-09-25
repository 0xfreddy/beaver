import { useQuery } from '@tanstack/react-query';

// Server-driven brand marks: stock tickers, crypto symbols and bank logos.
// The API caches the directory for an hour; when the API or the logo provider
// is unreachable callers fall back to bundled assets or initials.
export type LogoEntry = { key: string; name: string; uri: string | null };
export type LogoDirectory = {
  attribution: { name: string; url: string } | null;
  stocks: LogoEntry[];
  crypto: LogoEntry[];
  banks: { id: string; name: string; uri: string | null }[] | null;
};

export function useLogoDirectory() {
  return useQuery({
    queryKey: ['logo-directory'],
    staleTime: 3600000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
      if (!base?.startsWith('https://')) throw new Error('Logo directory unavailable.');
      const response = await fetch(`${base}/v1/logos`, { signal });
      if (!response.ok) throw new Error('Logo directory unavailable.');
      return (await response.json()) as LogoDirectory;
    },
  });
}

export function pickLogo(
  directory: Pick<LogoDirectory, 'stocks' | 'crypto'> | undefined,
  kind: 'stocks' | 'crypto',
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  return directory?.[kind].find((entry) => entry.key === key)?.uri ?? null;
}
