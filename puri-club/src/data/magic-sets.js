// Hand-made stamp sets for one-tap magic.

// One-tap magic picks from hand-made stamp sets instead of scattering stamps at random. Each stamp is
// [key, x, y, size, degrees]: x and y are fractions of the photo's width and height, and size is a fraction of its
// short edge, so a set fits both orientations; a set with "only":"portrait" or "landscape" is used in that one alone.
// Sets leave the face area clear, hold at most one word, and skip frame and accessory stamps (lace, tape, chains, pearls…).
// To add sets, open the page with ?magic-dev, arrange a photo by hand and copy it with the export button.
export const MAGIC_SETS = {
  gal: [
    {
      stamps: [
        ["109-style/109-03-crown", 0.2, 0.17, 0.41, -14],
        ["109-style/109-16-gems", 0.39, 0.08, 0.14, 10],
        ["109-style/109-14-stars", 0.08, 0.38, 0.16, 0],
        ["109-style/109-13-kiss", 0.84, 0.83, 0.32, 12],
        ["shared/PW-10_love", 0.19, 0.88, 0.3, -6],
      ],
    },
    {
      stamps: [
        ["109-style/109-04-butterfly", 0.83, 0.18, 0.41, 14],
        ["109-style/109-01-heart", 0.17, 0.16, 0.23, -10],
        ["109-style/109-04-butterfly", 0.15, 0.82, 0.26, -16],
        ["109-style/109-14-stars", 0.88, 0.66, 0.16, 0],
      ],
    },
    {
      stamps: [
        ["109-style/109-07-bow", 0.18, 0.15, 0.36, -8],
        ["109-style/109-01-heart", 0.85, 0.82, 0.31, 10],
        ["109-style/109-16-gems", 0.9, 0.63, 0.12, 0],
        ["109-style/109-14-stars", 0.09, 0.62, 0.15, 0],
        ["shared/PW-01_zuttomo", 0.8, 0.12, 0.3, 8],
      ],
    },
    {
      stamps: [
        ["109-style/109-13-kiss", 0.85, 0.16, 0.31, 16],
        ["109-style/109-01-heart", 0.13, 0.83, 0.28, -12],
        ["109-style/109-16-gems", 0.3, 0.92, 0.12, 0],
        ["109-style/109-14-stars", 0.68, 0.08, 0.14, 0],
        ["shared/PW-12_daisuki", 0.2, 0.12, 0.3, -8],
      ],
    },
    {
      stamps: [
        ["shared/PB-01_hand-heart", 0.15, 0.82, 0.32, -10],
        ["109-style/109-03-crown", 0.85, 0.15, 0.31, 12],
        ["shared/PB-05_sparkle-group", 0.13, 0.16, 0.2, 0],
        ["109-style/109-16-gems", 0.9, 0.4, 0.12, 0],
        ["shared/PW-05_best-friends", 0.74, 0.89, 0.41, -4],
      ],
    },
  ],
  hara: [
    {
      stamps: [
        ["harajuku-mix/01-bubble-star", 0.16, 0.16, 0.38, -12],
        ["harajuku-mix/13-three-stars", 0.86, 0.14, 0.24, 10],
        ["harajuku-mix/03-six-flower", 0.86, 0.83, 0.32, 8],
        ["harajuku-mix/18-paper-confetti", 0.12, 0.86, 0.22, 0],
        ["shared/PW-06_itsumen", 0.5, 0.92, 0.3, -3],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/02-checker-heart", 0.84, 0.18, 0.35, 12],
        ["harajuku-mix/14-rays", 0.14, 0.14, 0.27, 0],
        ["harajuku-mix/07-checker-bow", 0.15, 0.84, 0.32, -10],
        ["shared/PB-07_daisy", 0.88, 0.82, 0.19, 0],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/03-six-flower", 0.15, 0.18, 0.35, -6],
        ["shared/PB-07_daisy", 0.34, 0.08, 0.15, 0],
        ["harajuku-mix/01-bubble-star", 0.86, 0.82, 0.32, 14],
        ["harajuku-mix/13-three-stars", 0.86, 0.2, 0.19, -8],
        ["shared/PW-07_saikyou-combi", 0.25, 0.88, 0.38, -5],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/07-checker-bow", 0.18, 0.14, 0.32, -12],
        ["harajuku-mix/14-rays", 0.86, 0.84, 0.3, 0],
        ["harajuku-mix/01-bubble-star", 0.84, 0.16, 0.2, 10],
        ["harajuku-mix/02-checker-heart", 0.12, 0.82, 0.22, -8],
        ["shared/PB-06_smile-badge", 0.9, 0.6, 0.15, 0],
      ],
    },
    {
      stamps: [
        ["harajuku-mix/18-paper-confetti", 0.84, 0.14, 0.32, 0],
        ["harajuku-mix/03-six-flower", 0.16, 0.84, 0.3, 8],
        ["harajuku-mix/13-three-stars", 0.14, 0.16, 0.22, -10],
        ["shared/PW-08_muteki", 0.85, 0.85, 0.27, 8],
      ],
    },
  ],
  cyber: [
    {
      stamps: [
        ["cyber-angel/05-angel-wings", 0.18, 0.15, 0.41, -10],
        ["cyber-angel/13-ice-stars", 0.86, 0.14, 0.22, 0],
        ["cyber-angel/01-ice-butterfly", 0.85, 0.82, 0.35, 12],
        ["cyber-angel/14-glass-bubbles", 0.12, 0.82, 0.19, 0],
      ],
    },
    {
      stamps: [
        ["cyber-angel/01-ice-butterfly", 0.16, 0.18, 0.38, -14],
        ["cyber-angel/03-chrome-heart", 0.86, 0.84, 0.3, 10],
        ["cyber-angel/15-rhinestone-diamond", 0.9, 0.62, 0.14, 0],
        ["cyber-angel/13-ice-stars", 0.84, 0.14, 0.16, 0],
        ["shared/PW-15_omoide", 0.2, 0.88, 0.3, -6],
      ],
    },
    {
      stamps: [
        ["cyber-angel/07-ice-bow", 0.84, 0.16, 0.35, 12],
        ["cyber-angel/03-chrome-heart", 0.14, 0.82, 0.27, -10],
        ["cyber-angel/14-glass-bubbles", 0.12, 0.2, 0.19, 0],
        ["cyber-angel/13-ice-stars", 0.88, 0.82, 0.19, 0],
        ["cyber-angel/15-rhinestone-diamond", 0.32, 0.08, 0.12, -12],
      ],
    },
    {
      stamps: [
        ["cyber-angel/03-chrome-heart", 0.18, 0.16, 0.32, -12],
        ["cyber-angel/05-angel-wings", 0.84, 0.84, 0.35, 8],
        ["cyber-angel/15-rhinestone-diamond", 0.36, 0.08, 0.12, 15],
        ["shared/PB-05_sparkle-group", 0.88, 0.16, 0.19, 0],
        ["cyber-angel/14-glass-bubbles", 0.14, 0.86, 0.2, 0],
      ],
    },
    {
      stamps: [
        ["cyber-angel/13-ice-stars", 0.14, 0.14, 0.27, 0],
        ["cyber-angel/01-ice-butterfly", 0.86, 0.2, 0.3, 14],
        ["cyber-angel/01-ice-butterfly", 0.82, 0.84, 0.19, -10],
        ["cyber-angel/14-glass-bubbles", 0.16, 0.84, 0.22, 0],
      ],
    },
  ],
};
