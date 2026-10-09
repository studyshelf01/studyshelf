"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SavedResource = {
  id: number;
  title: string;
  description: string | null;
  grade: string | null;
  subject: string | null;
  topic: string | null;
  type: string | null;
  file_url: string;
  uploader_name: string | null;
};

export default function SavedResourcesPage() {
  const router = useRouter();

  const [resources, setResources] = useState<SavedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSavedResources() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/student-login");
        return;
      }

      const { data, error } = await supabase
        .from("saved_resources")
        .select(
          `
          resource_id,
          resources (
            id,
            title,
            description,
            grade,
            subject,
            topic,
            type,
            file_url,
            uploader_name
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Saved resources error:", error);
        setMessage("Could not load your saved resources.");
        setLoading(false);
        return;
      }

      const savedResources = (data || [])
        .map((item: any) => item.resources)
        .filter(Boolean);

      setResources(savedResources);
      setLoading(false);
    }

    loadSavedResources();
  }, [router]);

  async function removeSavedResource(resourceId: number) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/student-login");
      return;
    }

    const { error } = await supabase
      .from("saved_resources")
      .delete()
      .eq("user_id", user.id)
      .eq("resource_id", resourceId);

    if (error) {
      console.error("Remove saved resource error:", error);
      setMessage("Could not remove this resource.");
      return;
    }

    setResources((current) =>
      current.filter((resource) => resource.id !== resourceId)
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading saved resources...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-slate-900">
            StudyShelf
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Home
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

      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to resources
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-slate-900">
            ⭐ Saved Resources
          </h1>

          <p className="mt-2 text-slate-600">
            Resources you saved for later.
          </p>
        </div>

        {message && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </p>
        )}

        {resources.length === 0 ? (
          <section className="mt-8 rounded-3xl border bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">☆</div>

            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              No saved resources yet
            </h2>

            <p className="mt-2 text-slate-600">
              When you find something useful, click “☆ Save Resource” to keep
              it here.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Browse Resources
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-3xl border bg-white p-6 shadow-sm"
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

                <h2 className="mt-4 text-xl font-bold text-slate-900">
                  {resource.title}
                </h2>

                {resource.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {resource.description}
                  </p>
                )}

                {resource.topic && (
                  <p className="mt-3 text-sm text-slate-500">
                    Topic: {resource.topic}
                  </p>
                )}

                {resource.uploader_name && (
                  <p className="mt-2 text-sm text-slate-500">
                    Uploaded by {resource.uploader_name}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/resource/${resource.id}`}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    View Resource
                  </Link>

                  <button
                    onClick={() => removeSavedResource(resource.id)}
                    className="rounded-xl border px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}