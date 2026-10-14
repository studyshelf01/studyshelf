"use client";

import { useEffect } from "react";
import Link from "next/link";

export const THEME_STORAGE_KEY = "studyshelf-theme";

export const THEMES = [
  {
    id: "forest",
    name: "Forest Academia",
    description: "Forest green, warm ivory, and subtle gold.",
    background: "#f6f4e9",
    surface: "#fffdf6",
    primary: "#28543f",
    accent: "#c4a15b",
    text: "#26392f",
  },
  {
    id: "pink",
    name: "Pink Scrapbook",
    description: "Soft blush, rose, and creamy paper.",
    background: "#fff5f7",
    surface: "#fffafd",
    primary: "#b45d80",
    accent: "#e8b9cc",
    text: "#493743",
  },
  {
    id: "midnight",
    name: "Midnight Library",
    description: "Deep navy, cool mist, and silver accents.",
    background: "#111827",
    surface: "#1d293b",
    primary: "#647eb8",
    accent: "#b5c6ec",
    text: "#e8edf7",
  },
  {
    id: "garden",
    name: "Garden Notes",
    description: "Sage green, natural linen, and terracotta.",
    background: "#f3f3e9",
    surface: "#fffdf4",
    primary: "#657c55",
    accent: "#c77f60",
    text: "#344436",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function applyTheme(themeId: string) {
  const validTheme = THEMES.find((theme) => theme.id === themeId);
  const theme = validTheme ? validTheme.id : "forest";

  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still applies for the current page if storage is unavailable.
  }

  window.dispatchEvent(new Event("studyshelf-theme-change"));
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    function loadTheme() {
      try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        const validTheme = THEMES.some((theme) => theme.id === savedTheme);

        document.documentElement.dataset.theme = validTheme
          ? savedTheme!
          : "forest";
      } catch {
        document.documentElement.dataset.theme = "forest";
      }
    }

    loadTheme();

    window.addEventListener("studyshelf-theme-change", loadTheme);

    return () => {
      window.removeEventListener("studyshelf-theme-change", loadTheme);
    };
  }, []);

  return (
    <>
      {children}

      <Link href="/themes" className="theme-shortcut">
        <span aria-hidden="true">✦</span>
        <span>Themes</span>
      </Link>
    </>
  );
}