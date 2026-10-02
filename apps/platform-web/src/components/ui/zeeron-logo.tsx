"use client";

import clsx from "clsx";

/**
 * Rasmiy Zeeron logotipi (apps/admin-web/logo/zeeron-logo-transparent.svg dan),
 * inline SVG — har bir harf alohida, shuning uchun `animated` holatida ikkita
 * "e" navbatma-navbat ozgina tepaga-pastga tebranadi (yuklanish ekrani).
 * viewBox harflar atrofiga qirqilgan; o'lchami className orqali (h-… w-auto).
 */
const LETTERS = [
  { letter: "Z", fill: "#0B0B0C", transform: "translate(216.1,992.1) scale(1,-1)", d: "M46 0V122L449 610L451 589L421 629L441 613H58V730H606V608L202 121L199 144L232 99L208 117H611V0Z" },
  { letter: "e", fill: "#9F1239", transform: "translate(821.1,992.1) scale(1,-1)", d: "M322 -19Q252 -19 199.5 5.0Q147 29 112.5 69.5Q78 110 60.5 160.0Q43 210 43 262V281Q43 335 60.5 385.5Q78 436 112.5 475.5Q147 515 198.0 538.5Q249 562 316 562Q404 562 463.5 523.5Q523 485 553.0 422.5Q583 360 583 288V238H102V323H496L453 281Q453 333 438.0 370.0Q423 407 392.5 427.0Q362 447 316 447Q270 447 238.0 426.0Q206 405 189.5 365.5Q173 326 173 271Q173 220 189.0 180.5Q205 141 238.0 118.5Q271 96 322 96Q373 96 405.0 116.5Q437 137 446 167H574Q562 111 528.0 69.0Q494 27 441.5 4.0Q389 -19 322 -19Z" },
  { letter: "e", fill: "#9F1239", transform: "translate(1396.2,992.1) scale(1,-1)", d: "M322 -19Q252 -19 199.5 5.0Q147 29 112.5 69.5Q78 110 60.5 160.0Q43 210 43 262V281Q43 335 60.5 385.5Q78 436 112.5 475.5Q147 515 198.0 538.5Q249 562 316 562Q404 562 463.5 523.5Q523 485 553.0 422.5Q583 360 583 288V238H102V323H496L453 281Q453 333 438.0 370.0Q423 407 392.5 427.0Q362 447 316 447Q270 447 238.0 426.0Q206 405 189.5 365.5Q173 326 173 271Q173 220 189.0 180.5Q205 141 238.0 118.5Q271 96 322 96Q373 96 405.0 116.5Q437 137 446 167H574Q562 111 528.0 69.0Q494 27 441.5 4.0Q389 -19 322 -19Z" },
  { letter: "r", fill: "#CA8A04", transform: "translate(1971.2,992.1) scale(1,-1)", d: "M79 0V543H189V313H186Q186 430 236.0 490.0Q286 550 383 550H403V429H365Q295 429 256.5 391.5Q218 354 218 283V0Z" },
  { letter: "o", fill: "#0B0B0C", transform: "translate(2343.2,992.1) scale(1,-1)", d: "M340 -19Q268 -19 213.0 4.0Q158 27 120.0 66.5Q82 106 62.5 156.0Q43 206 43 260V281Q43 337 63.5 387.5Q84 438 122.5 477.5Q161 517 216.0 539.5Q271 562 340 562Q409 562 464.0 539.5Q519 517 557.5 477.5Q596 438 616.0 387.5Q636 337 636 281V260Q636 206 616.5 156.0Q597 106 559.0 66.5Q521 27 466.0 4.0Q411 -19 340 -19ZM340 100Q391 100 426.0 122.5Q461 145 479.0 183.5Q497 222 497 271Q497 321 478.5 359.5Q460 398 424.5 420.5Q389 443 340 443Q291 443 255.5 420.5Q220 398 201.0 359.5Q182 321 182 271Q182 222 200.5 183.5Q219 145 254.0 122.5Q289 100 340 100Z" },
  { letter: "n", fill: "#0B0B0C", transform: "translate(2977.2,992.1) scale(1,-1)", d: "M79 0V543H189V310H179Q179 393 201.0 448.5Q223 504 266.5 532.0Q310 560 375 560H381Q478 560 528.0 497.5Q578 435 578 311V0H439V323Q439 373 410.5 404.0Q382 435 332 435Q281 435 249.5 403.5Q218 372 218 319V0Z" },
] as const;

export function ZeeronLogo({ className, animated = false }: { className?: string; animated?: boolean }) {
  let eIndex = 0;
  return (
    <svg viewBox="254 254 3309 765" role="img" aria-label="Zeeron" className={clsx("block", className)}>
      {LETTERS.map((item, index) => {
        const path = <path fill={item.fill} transform={item.transform} d={item.d} />;
        if (!animated || item.letter !== "e") return <g key={index}>{path}</g>;
        const delay = eIndex++ * 0.45;
        return (
          <g key={index} className="zeeron-e-bob" style={{ animationDelay: `${delay}s` }}>
            {path}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Ixcham belgi — qora yumaloq kvadratda logodagi "Z" (yig'ilgan sidebar;
 * xuddi shu shakl src/app/icon.svg da brauzer tab belgisi).
 */
export function ZeeronMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Zeeron" className={clsx("block", className)}>
      <rect width="64" height="64" rx="14" fill="#0B0B0C" />
      <path fill="#FFFFFF" transform="translate(15.80,50.00) scale(0.04932,-0.04932)" d="M46 0V122L449 610L451 589L421 629L441 613H58V730H606V608L202 121L199 144L232 99L208 117H611V0Z" />
    </svg>
  );
}
