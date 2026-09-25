import { z } from 'zod';
export const aliasSchema = z
  .string()
  .refine((v) => !/[\p{Cc}\p{Cf}]/u.test(v), 'No controls')
  .transform((v) => v.trim())
  .refine((v) => [...v].length >= 2 && [...v].length <= 24, 'Use 2–24 characters');
export const avatarSchema = z.string().regex(/^glass-(0[1-9]|1[0-2])$/);
export const socialProfileSchema = z
  .object({
    alias: aliasSchema.optional(),
    avatarId: avatarSchema.optional(),
    globalOptIn: z.boolean().optional(),
  })
  .strict();
/** Invite codes are 4 characters from an unambiguous alphabet (no I, L, O, 0, 1). */
export const inviteCodeLength = 4;
export const inviteCodeRegex = new RegExp(`^[A-HJ-KM-NP-Z2-9]{${inviteCodeLength}}$`);
/** Accepts a personal invite code or a legacy 43-character one-time link token. */
export const inviteTokenSchema = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${inviteCodeLength}}$|^[A-Za-z0-9_-]{8}$|^[A-Za-z0-9_-]{43}$`));
/** Each inviter's code can be redeemed by at most this many distinct people. */
export const inviteRedeemLimit = 5;
export const achievementEventSchema = z
  .object({ criterion: z.enum(['introduction-complete', 'rules-reviewed']), version: z.literal(1) })
  .strict();
export type PublicProfile = {
  id: string;
  alias: string;
  avatarId: string;
  avatarVersion: 1;
  globalOptIn: boolean;
};
export type Friendship = { profile: PublicProfile; acceptedAt: string };
export type Invite = {
  id: string;
  expiresAt: string;
  revoked: boolean;
  /** Short typeable code; null on legacy one-time link invites. */
  code: string | null;
  /** Distinct people who redeemed any of this inviter's invites. */
  redeemed: number;
};
export type CreatedInvite = Invite & {
  token: string;
  link: string;
  linkMode: 'public' | 'internal';
  redeemLimit: number;
};
export type InviteResolution = {
  status:
    | 'available'
    | 'already-friends'
    | 'previously-accepted'
    | 'self'
    | 'expired'
    | 'revoked'
    | 'invalid'
    | 'blocked'
    | 'exhausted';
  inviter?: PublicProfile;
  /** Immutable display name for campaign referrals that do not expose a social profile. */
  inviterName?: string;
};
export type AchievementDefinition = {
  id: string;
  criterionVersion: 1;
  title: string;
  description: string;
  points: number;
  group?: string;
  assetKey: string;
};
export const achievementDefinitions: readonly AchievementDefinition[] = [
  {
    id: 'introduction-complete',
    criterionVersion: 1,
    title: 'First chapter',
    description: 'Finish the real introduction once. Replay is excluded.',
    points: 10,
    assetKey: 'introduction-complete',
  },
  {
    id: 'profile-personalized',
    criterionVersion: 1,
    title: 'Make it yours',
    description: 'Save an alias and an avatar selection.',
    points: 10,
    assetKey: 'profile-personalized',
  },
  {
    id: 'rules-reviewed',
    criterionVersion: 1,
    title: 'Know your roundups',
    description: 'Acknowledge the rules explanation. This is not investment consent.',
    points: 10,
    assetKey: 'rules-reviewed',
  },
  {
    id: 'first-friend',
    criterionVersion: 1,
    title: 'First connection',
    description: 'Accept a mutual invitation.',
    points: 10,
    assetKey: 'first-friend',
  },
  {
    id: 'three-friends',
    criterionVersion: 1,
    title: 'Small circle',
    description: 'Connect with three distinct people.',
    points: 10,
    assetKey: 'three-friends',
  },
  {
    id: 'five-friends',
    criterionVersion: 1,
    title: 'Growing circle',
    description: 'Connect with five distinct people.',
    points: 10,
    assetKey: 'five-friends',
  },
];
export type AchievementAward = { definitionId: string; criterionVersion: 1; earnedAt: string };
export type AchievementSummary = {
  metric: 'season-points';
  version: 2;
  points: number;
  legacyPoints?: number;
  progress?: Record<string, { current: number; target: number; unit: string }>;
  definitions: readonly AchievementDefinition[];
  awards: AchievementAward[];
  distinctFriends: number;
};
export type LeaderboardRow = {
  profile: PublicProfile;
  points: number;
  rank: number | null;
  isYou: boolean;
};
export type LeaderboardPage = {
  scope: 'global' | 'friends';
  metric: 'season-points';
  version: 2;
  season: import('./retention').Season;
  snapshot: string;
  updatedAt: string;
  rows: LeaderboardRow[];
  nextCursor: string | null;
  own: LeaderboardRow;
  total: number;
};
export const leaderboardQuerySchema = z.object({
  scope: z.enum(['global', 'friends']).default('friends'),
  cursor: z
    .string()
    .max(100)
    .regex(/^[a-f0-9-]{36}:\d+$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
