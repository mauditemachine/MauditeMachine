/**
 * Data pour les tracks avec liens SoundCloud
 */

export interface SoundCloudTrack {
  id: string;
  title: string;
  year: number;
  category: string;
  coverImage: string;
  soundcloudUrl: string;
  duration: string;
}

// URLs DIRECTES qui fonctionnent - on teste ça d'abord !
export const soundcloudTracks: SoundCloudTrack[] = [
  {
    id: "anarchic",
    title: "Anarchic",
    year: 2025,
    category: "Single",
    coverImage: "images/Anarchic.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/anarchic",
    duration: "4:23"
  },
  {
    id: "autopsynth",
    title: "Autopsynth",
    year: 2025,
    category: "Single",
    coverImage: "images/Autopsynth.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/autopsynth",
    duration: "5:12"
  },
  {
    id: "back-on-track",
    title: "Back On Track (Luminarium Mix)",
    year: 2025,
    category: "Single",
    coverImage: "images/BackOnTrack.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/back-on-track-luminarium-mix",
    duration: "6:18"
  },
  {
    id: "coagule",
    title: "Coagule",
    year: 2025,
    category: "Single",
    coverImage: "images/Coagule.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/coagule",
    duration: "5:45"
  },
  {
    id: "nocturne",
    title: "Nocturne",
    year: 2025,
    category: "Single",
    coverImage: "images/Nocturne.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/nocturne",
    duration: "4:56"
  },
  {
    id: "richie",
    title: "Richie (Original Mix)",
    year: 2025,
    category: "Single",
    coverImage: "images/Richie.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/richie-original-mix",
    duration: "5:33"
  },
  {
    id: "discowriders",
    title: "Discowriders",
    year: 2025,
    category: "Single",
    coverImage: "images/Discowriders.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/discowriders",
    duration: "6:02"
  },
  {
    id: "where-sync-button",
    title: "Where Is The Sync Button",
    year: 2025,
    category: "Single",
    coverImage: "images/Where.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/where-is-the-sync-button",
    duration: "5:28"
  },
  {
    id: "tati-cardi",
    title: "Tati Cardi",
    year: 2025,
    category: "Single",
    coverImage: "images/Tati%20Cardi.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/tati-cardi",
    duration: "7:15"
  },
  {
    id: "kouklikou",
    title: "Kouklikou",
    year: 2025,
    category: "Single",
    coverImage: "images/Kouklikou.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/kouklikou",
    duration: "4:41"
  },
  {
    id: "crush-on-you",
    title: "Crush On You (Original Mix)",
    year: 2025,
    category: "Single",
    coverImage: "images/Tati%20Cardi.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/crush-on-you-original-mix",
    duration: "5:07"
  },
  {
    id: "drama-queen",
    title: "Drama Queen (Original Mix)",
    year: 2024,
    category: "Single",
    coverImage: "images/Drama%20Queen%201.webp",
    soundcloudUrl: "https://soundcloud.com/mauditemachine/drama-queen-original-mix",
    duration: "6:24"
  }
];
