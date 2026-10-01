/**
 * GENERE par docs/presskit-2027/build.mjs : ne pas editer a la main.
 * Le press kit 2027 pour la visionneuse du site (/presskit) : les pages en
 * WebP, leur titre de section (alt), le PDF et ses liens (les memes
 * destinations que le PDF, rangees par groupe).
 */

export const KIT = {
  title: 'Press kit 2027',
  pdf: '/Presskit_Maudite_Machine_2027_generic.pdf',
  size: '2.0 MB',
  w: 1200,
  h: 1697,
  pages: [
  {
    src: "/press/pages/presskit-2027-01.webp",
    section: "Cover"
  },
  {
    src: "/press/pages/presskit-2027-02.webp",
    section: "Background"
  },
  {
    src: "/press/pages/presskit-2027-03.webp",
    section: "The sound"
  },
  {
    src: "/press/pages/presskit-2027-04.webp",
    section: "Selected shows"
  },
  {
    src: "/press/pages/presskit-2027-05.webp",
    section: "Listen"
  },
  {
    src: "/press/pages/presskit-2027-06.webp",
    section: "Technical and contact"
  }
],
} as const;

export const KIT_LINKS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = [
  [
    "Listen",
    [
      [
        "Mixtape 39, live at Groove & Bass 2026, Groove Town stage, 1 h 29",
        "https://soundcloud.com/mauditemachine/mixtape-39-maudite-machine"
      ],
      [
        "Coagule",
        "https://soundcloud.com/mauditemachine/coagule"
      ],
      [
        "Zenith",
        "https://soundcloud.com/mauditemachine/zenith-original-mix"
      ],
      [
        "Limbos",
        "https://soundcloud.com/mauditemachine/limbos-original-mix"
      ],
      [
        "Tati Cardi",
        "https://soundcloud.com/mauditemachine/tati-cardi-1"
      ],
      [
        "Montreal Calling",
        "https://soundcloud.com/8day-montreal/mauditemachine-montrealcalling"
      ],
      [
        "Limbos, album, VRSTL Records",
        "https://mauditemachine.bandcamp.com/album/limbos"
      ],
      [
        "Spotify",
        "https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4"
      ],
      [
        "Bandcamp",
        "https://mauditemachine.bandcamp.com/"
      ],
      [
        "Beatport",
        "https://www.beatport.com/artist/maudite-machine/500537"
      ],
      [
        "SoundCloud",
        "https://soundcloud.com/mauditemachine"
      ]
    ]
  ],
  [
    "Site and documents",
    [
      [
        "mauditemachine.com",
        "https://mauditemachine.com/"
      ],
      [
        "mauditemachine.com/press",
        "https://mauditemachine.com/press"
      ],
      [
        "Tech rider (PDF)",
        "https://mauditemachine.com/Tech_Rider_Maudite_Machine_2026-27.pdf"
      ],
      [
        "vrstlrecords.com",
        "https://vrstlrecords.com/"
      ]
    ]
  ],
  [
    "Contact",
    [
      [
        "Diane: vrstlrecords@gmail.com",
        "mailto:vrstlrecords@gmail.com"
      ],
      [
        "Mika: mauditemachine@gmail.com",
        "mailto:mauditemachine@gmail.com"
      ],
      [
        "Mika: +1 514 653 1423",
        "tel:+15146531423"
      ]
    ]
  ],
  [
    "Links",
    [
      [
        "Apple Music",
        "https://music.apple.com/artist/1028417516"
      ],
      [
        "Deezer",
        "https://www.deezer.com/artist/8651600"
      ],
      [
        "Instagram",
        "https://www.instagram.com/mauditemachine/"
      ],
      [
        "Facebook",
        "https://www.facebook.com/MauditeMachine"
      ],
      [
        "TikTok",
        "https://www.tiktok.com/@mauditemachine"
      ],
      [
        "YouTube",
        "https://www.youtube.com/@mauditemachine-official"
      ],
      [
        "Mixcloud",
        "https://www.mixcloud.com/mauditemachine/"
      ],
      [
        "Songkick",
        "https://www.songkick.com/artists/10363218"
      ],
      [
        "gigmit",
        "https://www.gigmit.com/maudite-machine"
      ]
    ]
  ]
];
