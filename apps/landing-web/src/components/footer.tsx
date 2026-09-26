"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "./reveal";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m20.5 4-3 16.2-8.2-3.3M20.5 4 3.5 10.7l5.8 2.2M20.5 4 9.3 12.9l-.06 4.2" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PhoneIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M4 3.5h3.2l1.3 3.8-2 1.6a10.5 10.5 0 0 0 4.6 4.6l1.6-2 3.8 1.3V16a1.5 1.5 0 0 1-1.5 1.5C8.6 17.5 2.5 11.4 2.5 5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

function MailIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3.5 5.5 6.5 5 6.5-5" />
    </svg>
  );
}

function PinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M10 17.5S16 12.6 16 8a6 6 0 1 0-12 0c0 4.6 6 9.5 6 9.5Z" />
      <circle cx="10" cy="8" r="2.2" />
    </svg>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const t = useTranslations();

  const QUICK_LINKS = [
    { label: t("nav.home"), href: "/#top" },
    { label: t("nav.features"), href: "/#classrooms" },
    { label: t("nav.about"), href: "/#about" },
    { label: t("nav.contact"), href: "/#contact" },
  ];

  const GROUPS_LINKS = [
    { label: t("groups.schedule"), href: "/jadval" },
    { label: t("groups.meals"), href: "/taomlar" },
    { label: t("groups.teacher"), href: "/tarbiyachi" },
    { label: t("groups.education"), href: "/talim-yonalishi" },
    { label: t("groups.teachers"), href: "/oqituvchilar" },
  ];

  return (
    <footer
      id="contact"
      className="border-t border-[var(--color-border)]"
      style={{
        backgroundColor: "var(--color-surface)",
      }}
    >
      <div className="mx-auto max-w-[1120px] px-4 py-14 sm:py-16">
        <Reveal direction="up" className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.1fr] lg:gap-8">
          <div>
            <a href="/#top" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- statik brend rasmi */}
              <img src="/logo.png" alt="Vista Academy" className="h-12 w-12 object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element -- statik brend rasmi */}
              <img src="/logo-name.png" alt="Vista Academy" className="h-8 w-auto object-contain" />
            </a>
            <p className="mt-4 max-w-[320px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              {t("footer.description")}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
              >
                <TelegramIcon className="h-5 w-5" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <p className="font-heading text-[15px] font-bold text-[var(--color-text)]">{t("footer.pagesHeading")}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-heading text-[15px] font-bold text-[var(--color-text)]">{t("footer.groupsHeading")}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {GROUPS_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-heading text-[15px] font-bold text-[var(--color-text)]">{t("footer.contactHeading")}</p>
            <ul className="mt-4 flex flex-col gap-3">
              <li className="flex items-start gap-2.5 text-[14px] text-[var(--color-text-muted)]">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-blue)" }} />
                {t("footer.address")}
              </li>
              <li>
                <a
                  href="tel:+998901234567"
                  className="flex items-center gap-2.5 text-[14px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  <PhoneIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-blue)" }} />
                  +998 90 123 45 67
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@vistaacademy.uz"
                  className="flex items-center gap-2.5 text-[14px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  <MailIcon className="h-4 w-4 shrink-0" style={{ color: "var(--color-blue)" }} />
                  info@vistaacademy.uz
                </a>
              </li>
            </ul>
            <a
              href="/ariza"
              className="mt-5 inline-flex rounded-full px-5 py-2.5 text-[14px] font-bold text-white shadow-[var(--shadow-cta)] transition-transform duration-150 hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
            >
              {t("common.cta")}
            </a>
          </div>
        </Reveal>
      </div>

      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-[13px] text-[var(--color-text-muted)]">{t("footer.copyright", { year })}</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
