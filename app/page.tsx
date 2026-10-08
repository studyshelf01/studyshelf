"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  grade: string | null;
  subject: string | null;
  topic: string | null;
  type: string | null;
  status: string;
  file_url: string;
  uploader_name: string | null;
};

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResources() {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setResources(data);
      }

      setLoading(false);
    }

    loadResources();
  }, []);

  const subjects = [
    "All Subjects",
    ...Array.from(
      new Set(resources.map((resource) => resource.subject).filter(Boolean))
    ),
  ];

  const grades = [
    "All Grades",
    ...Array.from(
      new Set(resources.map((resource) => resource.grade).filter(Boolean))
    ),
  ];

  const filteredResources = resources.filter((resource) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      resource.title.toLowerCase().includes(searchText) ||
      (resource.description || "").toLowerCase().includes(searchText) ||
      (resource.subject || "").toLowerCase().includes(searchText) ||
      (resource.grade || "").toLowerCase().includes(searchText) ||
      (resource.topic || "").toLowerCase().includes(searchText);

    const matchesSubject =
      subjectFilter === "All Subjects" ||
      resource.subject === subjectFilter;

    const matchesGrade =
      gradeFilter === "All Grades" ||
      resource.grade === gradeFilter;

    return matchesSearch && matchesSubject && matchesGrade;
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            StudyShelf
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/admin-login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Admin
            </Link>

            <Link
              href="/upload"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Upload Resource
            </Link>
          </div>
        </div>
      </nav>

      <section className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Student Resource Hub
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Find what you need.
              <br />
              Share what you know.
            </h1>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Search and share useful study resources with other students.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, subjects, topics..."
              className="flex-1 rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
            />

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-xl border bg-white px-4 py-3 outline-none"
            >
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-xl border bg-white px-4 py-3 outline-none"
            >
              {grades.map((grade) => (
                <option key={grade}>{grade}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Latest Resources</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredResources.length}{" "}
              {filteredResources.length === 1 ? "resource" : "resources"} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <p className="text-slate-500">Loading resources...</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <h3 className="text-lg font-semibold">
              No approved resources yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Try a different search or upload a resource for review.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex flex-wrap gap-2">
                  {resource.grade && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {resource.grade}
                    </span>
                  )}

                  {resource.subject && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {resource.subject}
                    </span>
                  )}

                  {resource.type && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {resource.type}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  {resource.title}
                </h3>

                {resource.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                    {resource.description}
                  </p>
                )}

                {resource.topic && (
                  <p className="mt-3 text-sm text-slate-500">
                    Topic: {resource.topic}
                  </p>
                )}

                {resource.uploader_name && (
                  <p className="mt-2 text-xs text-slate-400">
                    Uploaded by {resource.uploader_name}
                  </p>
                )}

                <Link
                  href={`/resource/${resource.id}`}
                  className="mt-6 block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  View Resource
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-bold">How StudyShelf works</h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <div className="text-2xl">🔎</div>
              <h3 className="mt-4 font-bold">Find</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Search for notes, assignments, practice questions, and other
                useful resources.
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <div className="text-2xl">📤</div>
              <h3 className="mt-4 font-bold">Share</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload resources and send them for admin approval.
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <div className="text-2xl">📚</div>
              <h3 className="mt-4 font-bold">Learn</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Discover resources shared by other students.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 px-6 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">StudyShelf</p>
            <p className="text-sm text-slate-400">
              Find what you need. Share what you know.
            </p>
          </div>

          <Link
            href="/upload"
            className="text-sm font-semibold text-slate-300 hover:text-white"
          >
            Upload a resource →
          </Link>
        </div>
      </footer>
    </main>
  );
}