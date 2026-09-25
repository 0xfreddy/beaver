import { Image } from 'react-native';
import { avatarFor } from '../lib/avatars';
export function ProfileAvatar({ id, size = 80 }: { id: string; size?: number }) {
  return (
    <Image
      accessible={false}
      source={avatarFor(id).source}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#777' }}
    />
  );
}
