"use client";

import { useEffect, useState } from "react";
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
};

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

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
      loadResources();
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
    } else {
      setResources(data || []);
    }

    setLoading(false);
  }

  const subjects = Array.from(
    new Set(resources.map((resource) => resource.subject).filter(Boolean))
  ).sort();

  const grades = Array.from(
    new Set(resources.map((resource) => resource.grade).filter(Boolean))
  ).sort();

  const filteredResources = resources.filter((resource) => {
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      !searchText ||
      resource.title.toLowerCase().includes(searchText) ||
      (resource.description || "").toLowerCase().includes(searchText) ||
      resource.subject.toLowerCase().includes(searchText) ||
      (resource.topic || "").toLowerCase().includes(searchText) ||
      resource.grade.toLowerCase().includes(searchText);

    const matchesSubject =
      !subject || resource.subject === subject;

    const matchesGrade =
      !grade || resource.grade === grade;

    return matchesSearch && matchesSubject && matchesGrade;
  });

  if (checkingLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">
            Checking your account...
          </p>
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

      {/* Hero */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Find what you need. Share what you know.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
            Search and share study resources with students.
          </p>

          <div className="mx-auto mt-8 max-w-3xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for notes, assignments, practice questions..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-4 text-sm shadow-sm outline-none focus:border-blue-500 sm:text-base"
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 md:grid-cols-4">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
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
            className="min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="">All Grades</option>

            {grades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch("");
              setSubject("");
              setGrade("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold hover:bg-gray-50 sm:col-span-2 md:col-span-2"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {/* Resources */}
      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Study Resources
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Browse resources shared by students.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-gray-50 p-8 text-center text-gray-500">
              Loading resources...
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="rounded-2xl border bg-gray-50 p-8 text-center">
              <h3 className="font-semibold">
                No resources found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((resource) => (
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
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold">
              How It Works
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Share useful resources and find what you need.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">🔎</div>

              <h3 className="mt-4 font-bold">
                Find Resources
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Search for notes, assignments, practice questions,
                and other study resources.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">📚</div>

              <h3 className="mt-4 font-bold">
                Share Resources
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Upload useful resources and help other students.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <div className="text-3xl">⭐</div>

              <h3 className="mt-4 font-bold">
                Help Each Other
              </h3>

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

          <div className="flex justify-center gap-4 sm:justify-end">
            <a
              href="/my-uploads"
              className="hover:text-gray-900"
            >
              My Uploads
            </a>

            <a
              href="/upload"
              className="hover:text-gray-900"
            >
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