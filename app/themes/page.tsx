"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  applyTheme,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "../theme-provider";

const previewSurfaces: Record<ThemeId, string> = {
  forest: "#fffdf6",
  pink: "#fffafd",
  midnight: "#27354a",
  garden: "#fffdf4",
};

export default function ThemesPage() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("forest");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

      if (THEMES.some((theme) => theme.id === savedTheme)) {
        setSelectedTheme(savedTheme as ThemeId);
      }
    } catch {
      // Keep the default theme if browser storage is unavailable.
    }
  }, []);

  function handleApplyTheme(themeId: ThemeId) {
    applyTheme(themeId);
    setSelectedTheme(themeId);
  }

  return (
    <main className="themes-page">
      <div className="themes-container">
        <div className="themes-topline">
          <Link href="/" className="theme-back-link">
            ← Back to StudyShelf
          </Link>

          <span className="themes-eyebrow">Your personal space</span>
        </div>

        <header>
          <p className="themes-eyebrow">StudyShelf · Appearance</p>

          <h1 className="themes-heading">
            Make yourself
            <br />
            at home.
          </h1>

          <p className="themes-intro">
            Your study space should feel like yours. Choose a palette that
            makes opening your notes a little more enjoyable. Your choice
            changes your view of StudyShelf, not anyone else&apos;s.
          </p>

          <div className="themes-status">
            <span className="themes-status-dot" />
            Currently using{" "}
            <strong>
              {THEMES.find((theme) => theme.id === selectedTheme)?.name}
            </strong>
          </div>
        </header>

        <section aria-label="Available themes" className="themes-grid">
          {THEMES.map((theme) => {
            const isCurrent = selectedTheme === theme.id;

            return (
              <article className="theme-card" key={theme.id}>
                <div
                  className="theme-preview"
                  style={{
                    backgroundColor: theme.background,
                    color: theme.text,
                  }}
                >
                  <div className="preview-top">
                    <span className="preview-brand">StudyShelf.</span>

                    <span
                      className="preview-tag"
                      style={{
                        color: theme.primary,
                        borderColor: theme.accent,
                      }}
                    >
                      Your study space
                    </span>
                  </div>

                  <div
                    className="preview-paper"
                    style={{
                      backgroundColor: previewSurfaces[theme.id],
                      color: theme.text,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      A little progress,
                      <br />
                      every day.
                    </div>

                    <div
                      className="preview-line preview-line-long"
                      style={{ backgroundColor: theme.text }}
                    />

                    <div
                      className="preview-line preview-line-short"
                      style={{ backgroundColor: theme.text }}
                    />

                    <div className="preview-dots">
                      {[theme.primary, theme.accent, theme.text].map(
                        (color, index) => (
                          <span
                            className="preview-dot"
                            key={`${theme.id}-${index}`}
                            style={{ backgroundColor: color }}
                          />
                        ),
                      )}
                    </div>
                  </div>
                </div>

                <div className="theme-card-body">
                  <div className="theme-card-heading">
                    <div>
                      <h2 className="theme-card-title">{theme.name}</h2>
                      <p className="theme-card-description">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className="theme-swatches"
                    aria-label={`${theme.name} color palette`}
                  >
                    {[theme.background, theme.surface, theme.primary, theme.accent].map(
                      (color, index) => (
                        <span
                          key={`${theme.id}-swatch-${index}`}
                          className="theme-swatch"
                          style={{ backgroundColor: color }}
                        />
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    className={`theme-apply-button${isCurrent ? " is-current" : ""}`}
                    onClick={() => handleApplyTheme(theme.id)}
                    aria-pressed={isCurrent}
                  >
                    {isCurrent ? "✓ Currently applied" : "Apply theme"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="themes-note">
          <strong>Your theme, your choice.</strong> Your selection is saved in
          this browser, so it should still be here when you return on the same
          device and browser. It does not change other students&apos; themes.
          Clearing your browser data may reset your choice.
        </aside>
      </div>
    </main>
  );
}