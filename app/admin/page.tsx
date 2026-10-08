"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

export default function AdminPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadResources() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("ADMIN LOAD ERROR:", error);
      setMessage("Could not load pending resources.");
      setLoading(false);
      return;
    }

    setResources(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadResources();
  }, []);

  async function approveResource(id: number) {
    const { error } = await supabase
      .from("resources")
      .update({ status: "approved" })
      .eq("id", id);

    if (error) {
      console.error("APPROVE ERROR:", error);
      setMessage("Could not approve this resource.");
      return;
    }

    setResources((current) =>
      current.filter((resource) => resource.id !== id)
    );

    setMessage("Resource approved successfully!");
  }

  async function rejectResource(id: number) {
    const { error } = await supabase
      .from("resources")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      console.error("REJECT ERROR:", error);
      setMessage("Could not reject this resource.");
      return;
    }

    setResources((current) =>
      current.filter((resource) => resource.id !== id)
    );

    setMessage("Resource rejected.");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </a>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                StudyShelf Admin
              </p>

              <h1 className="mt-1 text-4xl font-bold text-gray-900">
                Admin Dashboard
              </h1>

              <p className="mt-2 text-gray-600">
                Review resources submitted by students.
              </p>
            </div>

            <div className="rounded-xl bg-white px-5 py-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Pending Resources
              </p>

              <p className="text-3xl font-bold text-gray-900">
                {resources.length}
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">
              Loading pending resources...
            </p>
          </div>
        )}

        {/* No resources */}
        {!loading && resources.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <div className="text-5xl">🎉</div>

            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              No pending resources
            </h2>

            <p className="mt-2 text-gray-600">
              Everything has been reviewed.
            </p>
          </div>
        )}

        {/* Resource list */}
        {!loading && resources.length > 0 && (
          <div className="space-y-5">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  {/* Resource information */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                        PENDING
                      </span>

                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {resource.type}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-bold text-gray-900">
                      {resource.title}
                    </h2>

                    {resource.description && (
                      <p className="mt-2 text-gray-600">
                        {resource.description}
                      </p>
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Grade
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {resource.grade}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Subject
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {resource.subject}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Topic
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {resource.topic || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Uploaded By
                        </p>
                        <p className="mt-1 font-medium text-gray-900">
                          {resource.uploader_name || "Anonymous"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-5 text-xs text-gray-400">
                      Submitted{" "}
                      {new Date(resource.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 lg:w-44">
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Preview File
                    </a>

                    <button
                      onClick={() => approveResource(resource.id)}
                      className="rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      ✓ Approve
                    </button>

                    <button
                      onClick={() => rejectResource(resource.id)}
                      className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}