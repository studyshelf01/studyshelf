"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

const demoResources = [
  {
    title: "Grade 9 Biology — Chapter 4 Notes",
    subject: "Biology",
    grade: "Grade 9",
    type: "Notes",
    description: "Clear revision notes covering the main concepts.",
  },
  {
    title: "Grade 10 Chemistry — Chapter 3 Practice",
    subject: "Chemistry",
    grade: "Grade 10",
    type: "Practice",
    description: "Practice questions for Chapter 3.",
  },
  {
    title: "Grade 9 Mathematics — Algebra Notes",
    subject: "Mathematics",
    grade: "Grade 9",
    type: "Notes",
    description: "Helpful algebra notes for revision.",
  },
];

export default function HomePage() {
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

      if (error) {
        console.error("RESOURCE LOAD ERROR:", error);
      } else {
        setResources(data || []);
      }

      setLoading(false);
    }

    loadResources();
  }, []);

  const filteredResources = resources.filter((resource) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      resource.title.toLowerCase().includes(searchText) ||
      resource.subject.toLowerCase().includes(searchText) ||
      resource.grade.toLowerCase().includes(searchText) ||
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
    <main className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-bold text-gray-900">
            Study<span className="text-blue-600">Shelf</span>
          </a>

          <div className="flex items-center gap-4">
            <a
              href="/admin-login"
              className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
            >
              Admin
            </a>

            <a
              href="/upload"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Upload Resource
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Student-powered study resources
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Find what you need.
            <br />
            <span className="text-blue-600">Share what you know.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Find useful notes, assignments, practice questions, and other
            study resources shared by students.
          </p>

          {/* Search */}
          <div className="mx-auto mt-10 max-w-3xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for Grade 9 biology notes..."
              className="w-full rounded-2xl border border-gray-300 bg-white px-6 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm"
          >
            <option>All Subjects</option>
            <option>Biology</option>
            <option>Chemistry</option>
            <option>Physics</option>
            <option>Mathematics</option>
            <option>English</option>
            <option>Moral Science</option>
          </select>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm"
          >
            <option>All Grades</option>
            <option>Grade 7</option>
            <option>Grade 8</option>
            <option>Grade 9</option>
            <option>Grade 10</option>
            <option>Grade 11</option>
            <option>Grade 12</option>
          </select>
        </div>
      </section>

      {/* Resources */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Study Resources
            </h2>

            <p className="mt-1 text-gray-600">
              Resources approved by the StudyShelf team.
            </p>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">Loading resources...</p>
          </div>
        )}

        {!loading && resources.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-4xl">📚</p>

            <h3 className="mt-4 text-xl font-bold text-gray-900">
              No approved resources yet
            </h3>

            <p className="mt-2 text-gray-600">
              Once an admin approves a submission, it will appear here.
            </p>

            <a
              href="/upload"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Upload a Resource
            </a>
          </div>
        )}

        {!loading &&
          resources.length > 0 &&
          filteredResources.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="text-3xl">🔎</p>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                No matching resources
              </h3>

              <p className="mt-2 text-gray-600">
                Try a different search or filter.
              </p>
            </div>
          )}

        {!loading && filteredResources.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {resource.type}
                  </span>

                  <span className="text-xs text-gray-400">
                    {resource.grade}
                  </span>
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  {resource.title}
                </h3>

                <p className="mt-2 text-sm font-medium text-blue-600">
                  {resource.subject}
                </p>

                {resource.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                    {resource.description}
                  </p>
                )}

                {resource.topic && (
                  <p className="mt-4 text-xs text-gray-500">
                    Topic: {resource.topic}
                  </p>
                )}

                <a
                  href={resource.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 block rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Open Resource
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              How StudyShelf works
            </h2>

            <p className="mt-3 text-gray-600">
              Simple, useful, and student-powered.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-6">
              <div className="text-3xl">🔎</div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                1. Find
              </h3>

              <p className="mt-2 text-gray-600">
                Search for resources by subject, grade, or topic.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-6">
              <div className="text-3xl">📚</div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                2. Learn
              </h3>

              <p className="mt-2 text-gray-600">
                Open useful resources and use them for revision.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-6">
              <div className="text-3xl">📤</div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                3. Share
              </h3>

              <p className="mt-2 text-gray-600">
                Upload your own helpful resources for other students.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} StudyShelf — Find what you need.
          Share what you know.
        </div>
      </footer>
    </main>
  );
}