import { useQuery } from '@tanstack/react-query';
export type Institution = {
  id: string;
  name: string;
  avatar: string | null;
  avatarDark: string | null;
  // Provider avatar when MoneyKit ships one, otherwise the server-side
  // logo.dev mark; renderable even when both provider fields are null.
  logo: string | null;
};
export function useInstitutionDirectory() {
  return useQuery({
    queryKey: ['bank-institution-directory'],
    staleTime: 3600000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
      if (!base?.startsWith('https://')) throw new Error('Bank catalogue unavailable.');
      const response = await fetch(`${base}/v1/bank/institutions`, { signal });
      if (!response.ok) throw new Error('Bank catalogue unavailable.');
      return (await response.json()) as {
        count: number;
        environment: string;
        items: Institution[];
      };
    },
  });
}
