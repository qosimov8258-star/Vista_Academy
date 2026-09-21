export type Group = {
  slug: string;
  name: string;
  /** Bosh sahifadagi kichik kartochka rasmi (mavjud bo'lsa). */
  image?: string;
  /** Guruh sahifasidagi katta rasm — hali hech birida yo'q, keyinroq qo'shiladi. */
  photo?: string;
  color: string;
};

const CARD_COLORS = [
  "#ef8a63",
  "#4ca6d4",
  "#61ae41",
  "#cf5599",
  "#e0a600",
  "#aead45",
  "#2f86b3",
  "#c4694e",
];

const GROUP_INPUT: { name: string; image?: string }[] = [
  { name: "Kichkintoylar", image: "/guruhlar/kichkintoylar.jpeg" },
  { name: "Quyoshcha", image: "/guruhlar/quyoshcha.png" },
  { name: "Vinni Pux", image: "/guruhlar/vinni-pux.jpg" },
  { name: "Bilimdonlar", image: "/guruhlar/erudit.jpeg" },
  { name: "Mikki Maus", image: "/guruhlar/mikki-maus.png" },
  { name: "Minionlar", image: "/guruhlar/miniona.png" },
  { name: "Qiziquvchanlar", image: "/guruhlar/lyuboznayki.jpeg" },
  { name: "Fiksiklar", image: "/guruhlar/fiksiki1.jpeg" },
  { name: "Pikachu", image: "/guruhlar/Pokemon.jpeg" },
  { name: "Smurfiklar", image: "/guruhlar/smurfiklar.png" },
  { name: "Negachilar", image: "/guruhlar/pochemuchka.jpeg" },
  { name: "Smeshariklar", image: "/guruhlar/smeshariki.jpeg" },
  { name: "Gnomiklar" },
  { name: "Kosmos", image: "/guruhlar/cosmos.jpeg" },
  { name: "Sayyora", image: "/guruhlar/planeta.jpeg" },
  { name: "Kamalak", image: "/guruhlar/raduga2.png" },
  { name: "Nemo", image: "/guruhlar/nemo.png" },
  { name: "Yulduzcha", image: "/guruhlar/yulduz.jpeg" },
  { name: "Buratino", image: "/guruhlar/buratino.jpeg" },
  { name: "Akademiklar", image: "/guruhlar/akademiki.jpeg" },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, "-");
}

export const GROUPS: Group[] = GROUP_INPUT.map((group, index) => ({
  ...group,
  slug: slugify(group.name),
  color: CARD_COLORS[index % CARD_COLORS.length],
}));

export function getGroupBySlug(slug: string) {
  return GROUPS.find((group) => group.slug === slug);
}
