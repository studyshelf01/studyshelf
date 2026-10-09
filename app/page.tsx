
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  topic: string | null;
  type: string;
  status: string;
  file_url: string;
  uploader_name: string | null;
  views: number;
};

type Review = {
  resource_id: number;
  rating: number;
};

type RatingSummary = {
  average: number;
  count: number;
};

type SortOption = "newest" | "most_viewed" | "highest_rated";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) {
    return 3;
  }

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function matchesSearch(query: string, resource: Resource) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = normalize(
    [
      resource.title,
      resource.description || "",
      resource.subject,
      resource.topic || "",
      resource.grade,
      resource.type,
    ].join(" ")
  );

  if (searchableText.includes(normalizedQuery)) {
    return true;
  }

  const queryWords = normalizedQuery.split(" ");
  const resourceWords = searchableText.split(" ");

  return queryWords.every((queryWord) => {
    return resourceWords.some((word) => {
      if (
        word === queryWord ||
        (queryWord.length >= 3 && word.startsWith(queryWord))
      ) {
        return true;
      }

      if (queryWord.length >= 5) {
        const allowedDistance = queryWord.length >= 8 ? 2 : 1;

        return editDistance(queryWord, word) <= allowedDistance;
      }

      return false;
    });
  });
}

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [ratings, setRatings] = useState<Record<number, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/student-login";
        return;
      }

      setIsLoggedIn(true);
      setCheckingLogin(false);
      await loadResources();
    }

    checkLogin();
  }, []);

  async function loadResources() {
    setLoading(true);

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("RESOURCE LOADING ERROR:", error);
      setLoading(false);
      return;
    }

    setResources((data || []) as Resource[]);

    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select("resource_id, rating");

    if (reviewError) {
      console.error("REVIEW LOADING ERROR:", reviewError);
    } else {
      const ratingMap: Record<number, RatingSummary> = {};

      (reviewData as Review[] | null)?.forEach((review) => {
        if (!ratingMap[review.resource_id]) {
          ratingMap[review.resource_id] = {
            average: 0,
            count: 0,
          };
        }

        ratingMap[review.resource_id].average += review.rating;
        ratingMap[review.resource_id].count += 1;
      });

      Object.keys(ratingMap).forEach((resourceId) => {
        const id = Number(resourceId);
        ratingMap[id].average /= ratingMap[id].count;
      });

      setRatings(ratingMap);
    }

    setLoading(false);
  }

  const subjects = Array.from(
    new Set(resources.map((resource) => resource.subject).filter(Boolean))
  ).sort();

  const grades = Array.from(
    new Set(resources.map((resource) => resource.grade).filter(Boolean))
  ).sort();

  const suggestions = useMemo(() => {
    const query = normalize(search);

    if (!query) {
      return [];
    }

    const candidates = new Set<string>();

    resources.forEach((resource) => {
      candidates.add(resource.title);
      candidates.add(`Grade ${resource.grade} ${resource.subject}`);

      if (resource.topic) {
        candidates.add(`${resource.subject} ${resource.topic}`);
        candidates.add(
          `Grade ${resource.grade} ${resource.subject} ${resource.topic}`
        );
      }
    });

    return Array.from(candidates)
      .filter((candidate) => {
        return (
          normalize(candidate).includes(query) ||
          matchesSearch(search, {
            id: 0,
            created_at: "",
            title: candidate,
            description: null,
            grade: "",
            subject: "",
            topic: null,
            type: "",
            status: "approved",
            file_url: "",
            uploader_name: null,
            views: 0,
          })
        );
      })
      .slice(0, 5);
  }, [resources, search]);

  const filteredResources = useMemo(() => {
    return resources
      .filter((resource) => {
        const matchesText = matchesSearch(debouncedSearch, resource);
        const matchesSubject = !subject || resource.subject === subject;
        const matchesGrade = !grade || resource.grade === grade;

        return matchesText && matchesSubject && matchesGrade;
      })
      .sort((a, b) => {
        if (sortBy === "most_viewed") {
          return (b.views || 0) - (a.views || 0);
        }

        if (sortBy === "highest_rated") {
          const ratingA = ratings[a.id]?.average || 0;
          const ratingB = ratings[b.id]?.average || 0;

          if (ratingA !== ratingB) {
            return ratingB - ratingA;
          }

          return (
            (ratings[b.id]?.count || 0) -
            (ratings[a.id]?.count || 0)
          );
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });
  }, [resources, debouncedSearch, subject, grade, sortBy, ratings]);

  function selectSuggestion(suggestion: string) {
    setSearch(suggestion);
    setDebouncedSearch(suggestion);
    setShowSuggestions(false);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setSubject("");
    setGrade("");
    setSortBy("newest");
    setShowSuggestions(false);
  }

  if (checkingLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">Checking your account...</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-gray-900">
      {/* Navbar */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href="/" className="text-2xl font-bold">
            StudyShelf
          </a>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <a
              href="/my-uploads"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-semibold hover:bg-gray-50 sm:flex-none"
            >
              My Uploads
            </a>

            <a
              href="/saved"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-semibold hover:bg-gray-50 sm:flex-none"
            >
              ⭐ Saved Resources
            </a>

            <a
              href="/upload"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:flex-none"
            >
              Upload Resource
            </a>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/student-login";
              }}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-semibold hover:bg-gray-50 sm:flex-none"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Hero and smarter search */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Find what you need. Share what you know.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Search and share study resources with students.
          </p>

          <div className="relative mx-auto mt-8 max-w-3xl text-left">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                🔎
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                  }

                  if (e.key === "Enter" && suggestions.length > 0) {
                    e.preventDefault();
                    selectSuggestion(suggestions[0]);
                  }
                }}
                placeholder="Try chemistry chapter 1 or biology notes..."
                autoComplete="off"
                aria-label="Search study resources"
                aria-expanded={showSuggestions && suggestions.length > 0}
                className="w-full rounded-xl border border-gray-300 bg-white py-4 pl-11 pr-12 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-base"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setShowSuggestions(false);
                  }}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-3 px-2 text-xl text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-lg">
                <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Suggestions
                </p>

                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50"
                  >
                    <span className="text-gray-400">↗</span>
                    <span className="break-words">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="mt-3 text-center text-xs text-gray-500">
              Search by title, subject, grade, topic, or resource type.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 md:grid-cols-4">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by subject"
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">All Subjects</option>
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            aria-label="Filter by grade"
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">All Grades</option>
            {grades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort resources"
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="newest">Newest</option>
            <option value="most_viewed">Most Viewed 🔥</option>
            <option value="highest_rated">Highest Rated ⭐</option>
          </select>

          <button
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {/* Resources */}
      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Study Resources</h2>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? "Loading resources..."
                : `${filteredResources.length} ${
                    filteredResources.length === 1
                      ? "resource"
                      : "resources"
                  } found`}
              {!loading &&
                sortBy === "most_viewed" &&
                " · Sorted by most viewed"}
              {!loading &&
                sortBy === "highest_rated" &&
                " · Sorted by highest rated"}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-gray-50 p-8 text-center text-gray-500">
              Loading resources...
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="rounded-2xl border bg-gray-50 p-8 text-center">
              <h3 className="font-semibold">No resources found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Try another spelling or change your search and filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Clear Search and Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((resource) => {
                const rating = ratings[resource.id];

                return (
                  <article
                    key={resource.id}
                    className="flex min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                  >
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {resource.type}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        {resource.grade}
                      </span>
                    </div>

                    <h3 className="break-words text-lg font-bold sm:text-xl">
                      {resource.title}
                    </h3>

                    <p className="mt-2 break-words text-sm text-gray-600">
                      {resource.subject}
                      {resource.topic ? ` • ${resource.topic}` : ""}
                    </p>

                    {rating ? (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-yellow-500">
                          {"★".repeat(Math.round(rating.average))}
                        </span>

                        <span className="font-semibold text-gray-700">
                          {rating.average.toFixed(1)}
                        </span>

                        <span className="text-gray-500">
                          · {rating.count}{" "}
                          {rating.count === 1 ? "review" : "reviews"}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-400">
                        No reviews yet
                      </p>
                    )}

                    {resource.description && (
                      <p className="mt-4 break-words text-sm leading-6 text-gray-600">
                        {resource.description}
                      </p>
                    )}

                    <div className="mt-auto pt-5">
                      <a
                        href={`/resource/${resource.id}`}
                        className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        View Resource
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold">How It Works</h2>
            <p className="mt-2 text-sm text-gray-600">
              Share useful resources and find what you need.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🔎</div>
              <h3 className="mt-4 font-bold">Find Resources</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Search for notes, assignments, practice questions,
                and other study resources.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">📚</div>
              <h3 className="mt-4 font-bold">Share Resources</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Upload useful resources and help other students.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">⭐</div>
              <h3 className="mt-4 font-bold">Help Each Other</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Rate and review resources to help students find
                useful material.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-center text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>StudyShelf</p>

          <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
            <a href="/my-uploads" className="hover:text-gray-900">
              My Uploads
            </a>

            <a href="/saved" className="hover:text-gray-900">
              ⭐ Saved Resources
            </a>

            <a href="/upload" className="hover:text-gray-900">
              Upload
            </a>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/student-login";
              }}
              className="hover:text-gray-900"
            >
              Log Out
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
