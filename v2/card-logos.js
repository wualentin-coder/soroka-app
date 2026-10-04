/*
 * Логотипы сетей на скидочных картах — маленькие SVG-знаки вместо нарисованных
 * «шаблонов» карт. Сеть узнаём по выбранному бренду или по названию карты;
 * цвет карты — свой, если выбран, иначе фирменный цвет сети.
 */

const CHAIN_LOGOS = [
  { re: /магнит/i, color: "#e30613", ink: "#fff", word: "магнит",
    svg: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 20V8.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3V20h-4.2v-11a1.6 1.6 0 0 0-3.2 0v11h-3.2v-11a1.6 1.6 0 0 0-3.2 0v11z"/></svg>` },
  { re: /пят[её]рочк/i, color: "#d71920", ink: "#fff", word: "Пятёрочка",
    svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path fill="#d71920" d="M8.2 5h8v2.6h-5.3l-.4 2.6a4.6 4.6 0 0 1 2.2-.5 4.4 4.4 0 0 1 4.5 4.6c0 3-2.3 5-5.3 5-2.2 0-3.9-1-4.7-2.6l2.2-1.3c.5.9 1.4 1.4 2.4 1.4 1.4 0 2.4-1 2.4-2.4s-1-2.3-2.4-2.3c-.9 0-1.6.4-2.1 1L7 12.3z"/><path fill="#5bb030" d="M17.5 3.5c1.5.3 2.6 1.4 2.9 2.8-1.5-.2-2.7-1.2-2.9-2.8z"/></svg>` },
  { re: /перекр[её]ст/i, color: "#0b6e35", ink: "#fff", word: "ПЕРЕКРЁСТОК",
    svg: `<svg viewBox="0 0 24 24"><path fill="#9bd23c" d="M4 4h5l3 5 3-5h5l-5.5 8L20 20h-5l-3-5-3 5H4l5.5-8z"/></svg>` },
  { re: /лента/i, color: "#003c96", ink: "#fff", word: "ЛЕНТА",
    svg: `<svg viewBox="0 0 24 24"><path fill="#ffd200" d="M2 8c4-3 8 3 12 0s6-2 8-1v6c-2-1-4-2-8 1s-8-3-12 0z"/></svg>` },
  { re: /fix\s*price|фикс\s*прайс/i, color: "#0057b8", ink: "#fff", word: "FIX PRICE",
    svg: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3" fill="#ffd200"/><path fill="#0057b8" d="M6 9h5v1.8H8v1.2h2.6v1.8H8V16H6zm7 0h2.4l1.6 3.4L18.6 9H21l-2.8 7h-2.4z"/></svg>` },
  { re: /горздрав/i, color: "#1d8f4e", ink: "#fff", word: "ГОРЗДРАВ",
    svg: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>` },
  { re: /вкусвилл/i, color: "#2bb24c", ink: "#fff", word: "ВкусВилл",
    svg: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 21C6 17 4 12 5 6c3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 1 6-1 11-7 15z"/></svg>` },
  { re: /ашан|auchan/i, color: "#e2001a", ink: "#fff", word: "АШАН",
    svg: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3c2 3 6 4 9 3-1 6-4 10-9 15C7 16 4 12 3 6c3 1 7 0 9-3z"/><path fill="#5ab031" d="M12 8c1 2 3 3 5 3-1 3-3 5-5 7-2-2-4-4-5-7 2 0 4-1 5-3z"/></svg>` },
  { re: /дикси/i, color: "#f07d00", ink: "#fff", word: "ДИКСИ",
    svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fff"/><path fill="#f07d00" d="M8 7h4.5a5 5 0 0 1 0 10H8zm2.5 2.4v5.2h1.8a2.6 2.6 0 0 0 0-5.2z"/></svg>` },
  { re: /спортмастер/i, color: "#e30613", ink: "#fff", word: "СПОРТМАСТЕР",
    svg: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M3 18 12 4l9 14h-5l-4-6.5L8 18z"/></svg>` },
  { re: /л[ьъ]?этуаль|letoile/i, color: "#111", ink: "#fff", word: "Л'ЭТУАЛЬ",
    svg: `<svg viewBox="0 0 24 24"><path fill="#d7b46a" d="m12 2 2.6 6.9H22l-6 4.6 2.3 7.2L12 16.3l-6.3 4.4L8 13.5 2 8.9h7.4z"/></svg>` },
  { re: /золотое\s*яблоко|goldapple/i, color: "#f9e547", ink: "#111", word: "ЗОЛОТОЕ ЯБЛОКО",
    svg: `<svg viewBox="0 0 24 24"><path fill="#111" d="M12 7c2-2 6-2 7.5 1.5S19 18 15.5 20c-1.5.8-2.5 0-3.5 0s-2 .8-3.5 0C5 18 3 12 4.5 8.5S10 5 12 7z"/><path fill="#111" d="M12 6c0-2 1.5-3.5 3.5-3.5C15.5 4.5 14 6 12 6z"/></svg>` },
];

/** Настоящие логотипы (SVG из Википедии) — знак для плашки и целиком; у остальных сетей — рисованный знак. */
const REAL_LOGOS = { "пят": "pyaterochka", "магнит": "magnit", "перекр": "perekrestok", "лента": "lenta", "fix": "fixprice" };
CHAIN_LOGOS.forEach(chain => {
  const key = Object.entries(REAL_LOGOS).find(([part]) => chain.re.source.toLowerCase().includes(part))?.[1];
  if (key) { chain.real = key; chain.svg = `<img src="./assets/emblem-${key}.svg" alt="">`; }
});

/** Сеть по бренду или названию карты. */
function chainOf(item) {
  const text = `${item?.brand === "magnit" ? "магнит" : item?.brand === "pyaterochka" ? "пятёрочка" : item?.brand === "perekrestok" ? "перекрёсток" : ""} ${item?.title || ""}`;
  return CHAIN_LOGOS.find(chain => chain.re.test(text)) || null;
}
