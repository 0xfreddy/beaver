/* Bundled Metro assets require static require calls. */
/* eslint-disable @typescript-eslint/no-require-imports */
export const avatars = [
  {
    id: 'glass-01',
    name: 'Cheeky Beaver',
    source: require('../../assets/avatars/beaver-01.png'),
    tab: require('../../assets/avatars/beaver-01-tab.png'),
  },
  {
    id: 'glass-02',
    name: 'Hello Beaver',
    source: require('../../assets/avatars/beaver-02.png'),
    tab: require('../../assets/avatars/beaver-02-tab.png'),
  },
  {
    id: 'glass-03',
    name: 'Curious Beaver',
    source: require('../../assets/avatars/beaver-03.png'),
    tab: require('../../assets/avatars/beaver-03-tab.png'),
  },
  {
    id: 'glass-04',
    name: 'Winking Beaver',
    source: require('../../assets/avatars/beaver-04.png'),
    tab: require('../../assets/avatars/beaver-04-tab.png'),
  },
  {
    id: 'glass-05',
    name: 'Happy Beaver',
    source: require('../../assets/avatars/beaver-05.png'),
    tab: require('../../assets/avatars/beaver-05-tab.png'),
  },
  {
    id: 'glass-06',
    name: 'Copper glow gradient',
    source: require('../../assets/avatars/glass-06.png'),
    tab: require('../../assets/avatars/glass-06-tab.png'),
  },
  {
    id: 'glass-07',
    name: 'Ocean ink gradient',
    source: require('../../assets/avatars/glass-07.png'),
    tab: require('../../assets/avatars/glass-07-tab.png'),
  },
  {
    id: 'glass-08',
    name: 'Moss light gradient',
    source: require('../../assets/avatars/glass-08.png'),
    tab: require('../../assets/avatars/glass-08-tab.png'),
  },
  {
    id: 'glass-09',
    name: 'Peach pearl gradient',
    source: require('../../assets/avatars/glass-09.png'),
    tab: require('../../assets/avatars/glass-09-tab.png'),
  },
  {
    id: 'glass-10',
    name: 'Plum frost gradient',
    source: require('../../assets/avatars/glass-10.png'),
    tab: require('../../assets/avatars/glass-10-tab.png'),
  },
  {
    id: 'glass-11',
    name: 'Sky stone gradient',
    source: require('../../assets/avatars/glass-11.png'),
    tab: require('../../assets/avatars/glass-11-tab.png'),
  },
  {
    id: 'glass-12',
    name: 'Graphite gradient',
    source: require('../../assets/avatars/glass-12.png'),
    tab: require('../../assets/avatars/glass-12-tab.png'),
  },
] as const;
export function avatarFor(id: string) {
  return avatars.find((a) => a.id === id) ?? avatars[11]!;
}
