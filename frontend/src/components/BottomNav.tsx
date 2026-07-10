"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavigationItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/time",
    label: "Время",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke="currentColor"
          strokeWidth="1.8"
        />

        <path
          d="M12 7.5V12l3 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Задания",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9 6h10M9 12h10M9 18h10"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />

        <path
          d="m4.5 6 1 1 2-2M4.5 12l1 1 2-2M4.5 18l1 1 2-2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "Сообщить о",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6.5h16v11H4z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />

        <path
          d="m5 7.5 7 5 7-5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="8"
          r="3.2"
          stroke="currentColor"
          strokeWidth="1.7"
        />

        <path
          d="M5.5 19c.7-3.2 3-5 6.5-5s5.8 1.8 6.5 5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function isItemActive(
  pathname: string,
  href: string,
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="work-bottom-nav"
      aria-label="Основное меню"
    >
      {navigationItems.map((item) => {
        const active = isItemActive(
          pathname,
          item.href,
        );

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "work-bottom-link",
              active
                ? "work-bottom-link-active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={
              active ? "page" : undefined
            }
          >
            <span className="work-bottom-icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
