import { assetUrl } from "./api";
import type { LandingGroup } from "./types";

export type GroupStudent = {
  name: string;
  bio?: string;
  photo?: string;
};

export type Group = {
  slug: string;
  name: string;
  /** Bosh sahifadagi kichik kartochka rasmi (mavjud bo'lsa). */
  image?: string;
  /** Guruh sahifasidagi katta rasm — hali hech birida yo'q, keyinroq qo'shiladi. */
  photo?: string;
  color: string;
  /** Admin panelda "O'quvchilar" bo'limida kiritilgan haqiqiy o'quvchilar. */
  students: GroupStudent[];
  /** Admin panelda "Guruh sahifasidagi rasmlar" bo'limida qo'shilgan galereya. */
  photos: string[];
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

const PLACEHOLDER_INPUT: { name: string; image?: string }[] = [
  { name: "Kichkintoylar", image: "/guruhlar/kichkintoylar.jpeg" },
  { name: "Quyoshcha", image: "/guruhlar/quyoshcha.png" },
  { name: "Vinni Pux", image: "/guruhlar/vinnipux.jpeg" },
  { name: "Bilimdonlar", image: "/guruhlar/erudit.jpeg" },
  { name: "Mikki Maus", image: "/guruhlar/mikki-maus.png" },
  { name: "Minionlar", image: "/guruhlar/miniona.png" },
  { name: "Qiziquvchanlar", image: "/guruhlar/lyuboznayki.jpeg" },
  { name: "Fiksiklar", image: "/guruhlar/fiksiki1.jpeg" },
  { name: "Pikachu", image: "/guruhlar/pikachu.jpeg" },
  { name: "Smurfiklar", image: "/guruhlar/smurfiklar.png" },
  { name: "Negachilar", image: "/guruhlar/pochemuchka.jpeg" },
  { name: "Smeshariklar", image: "/guruhlar/smeshariki.png" },
  { name: "Gnomiklar", image: "/guruhlar/ginom.jpeg" },
  { name: "Kosmos", image: "/guruhlar/cosmos1.jpeg" },
  { name: "Sayyora", image: "/guruhlar/planeta.jpeg" },
  { name: "Kamalak", image: "/guruhlar/raduga2.png" },
  { name: "Nemo", image: "/guruhlar/nemo.png" },
  { name: "Yulduzcha", image: "/guruhlar/yulduz.jpeg" },
  { name: "Buratino", image: "/guruhlar/" },
  { name: "Akademiklar", image: "/guruhlar/akademiki.jpeg" },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, "-");
}

/** Admin panelda hali guruh kiritilmagan bo'lsa ham sahifa bo'sh ko'rinmasin deb ko'rsatiladigan namunaviy ro'yxat. */
export const PLACEHOLDER_GROUPS: Group[] = PLACEHOLDER_INPUT.map((group, index) => ({
  ...group,
  slug: slugify(group.name),
  color: CARD_COLORS[index % CARD_COLORS.length],
  students: [],
  photos: [],
}));

/** Admin panelda ("Lending sahifa" → "Guruhlar") kiritilgan haqiqiy guruhlarni sahifada ko'rsatiladigan shaklga o'giradi. */
export function toDisplayGroups(groups: LandingGroup[]): Group[] {
  return groups.map((group, index) => ({
    slug: group.slug,
    name: group.name,
    image: assetUrl(group.photoPath) ?? undefined,
    photo: assetUrl(group.photoPath) ?? undefined,
    color: CARD_COLORS[index % CARD_COLORS.length],
    students: group.students.map((student) => ({
      name: student.name,
      bio: student.bio ?? undefined,
      photo: assetUrl(student.photoPath) ?? undefined,
    })),
    photos: group.photos.map((photo) => assetUrl(photo.path)).filter((path): path is string => !!path),
  }));
}

export function getGroupBySlug(groups: Group[], slug: string) {
  return groups.find((group) => group.slug === slug);
}
