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

type Review = {
  id: number;
  created_at: string;
  resource_id: number;
  reviewer_name: string | null;
  rating: number;
  review_text: string | null;
};

type ReviewWithResource = Review & {
  resource_title: string;
};

export default function AdminPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [reviews, setReviews] = useState<ReviewWithResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadResources() {
    setLoading(true);

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .in("status", ["pending", "approved", "hidden"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Resource loading error:", error);
      setMessage(`Could not load resources: ${error.message}`);
    } else {
      setResources(data || []);
    }

    setLoading(false);
  }

  async function loadReviews() {
    setReviewsLoading(true);

    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (reviewError) {
      console.error("Review loading error:", reviewError);
      setMessage(`Could not load reviews: ${reviewError.message}`);
      setReviewsLoading(false);
      return;
    }

    if (!reviewData || reviewData.length === 0) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }

    const resourceIds = Array.from(
      new Set(reviewData.map((review) => review.resource_id))
    );

    const { data: resourceData, error: resourceError } = await supabase
      .from("resources")
      .select("id, title")
      .in("id", resourceIds);

    if (resourceError) {
      console.error("Review resource loading error:", resourceError);
      setMessage(
        `Could not load review resources: ${resourceError.message}`
      );
      setReviewsLoading(false);
      return;
    }

    const resourceTitleMap = new Map<number, string>();

    (resourceData || []).forEach((resource) => {
      resourceTitleMap.set(resource.id, resource.title);
    });

    const reviewsWithResources: ReviewWithResource[] = reviewData.map(
      (review) => ({
        ...review,
        resource_title:
          resourceTitleMap.get(review.resource_id) ||
          `Resource #${review.resource_id}`,
      })
    );

    setReviews(reviewsWithResources);
    setReviewsLoading(false);
  }

  useEffect(() => {
    loadResources();
    loadReviews();
  }, []);

  async function updateStatus(id: number, status: string) {
    setMessage("");

    const { error } = await supabase
      .from("resources")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`Could not update resource: ${error.message}`);
      return;
    }

    if (status === "rejected") {
      setResources((current) =>
        current.filter((resource) => resource.id !== id)
      );

      setMessage("Resource rejected.");
      return;
    }

    setResources((current) =>
      current.map((resource) =>
        resource.id === id ? { ...resource, status } : resource
      )
    );

    if (status === "approved") {
      setMessage("Resource approved.");
    } else if (status === "hidden") {
      setMessage("Resource hidden.");
    }
  }

  async function removeResource(resource: Resource) {
    const confirmed = window.confirm(
      `Permanently remove "${resource.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");

    try {
      const fileUrl = new URL(resource.file_url);
      const marker = "/storage/v1/object/public/resources/";
      const markerIndex = fileUrl.pathname.indexOf(marker);

      if (markerIndex !== -1) {
        const filePath = decodeURIComponent(
          fileUrl.pathname.substring(markerIndex + marker.length)
        );

        const { error: storageError } = await supabase.storage
          .from("resources")
          .remove([filePath]);

        if (storageError) {
          console.error("Storage deletion error:", storageError);
        }
      }
    } catch (error) {
      console.error("Could not determine storage file:", error);
    }

    const { error: databaseError } = await supabase
      .from("resources")
      .delete()
      .eq("id", resource.id);

    if (databaseError) {
      console.error(databaseError);
      setMessage(`Could not remove resource: ${databaseError.message}`);
      return;
    }

    setResources((current) =>
      current.filter((item) => item.id !== resource.id)
    );

    setMessage("Resource permanently removed.");

    await loadReviews();
  }

  async function removeReview(review: ReviewWithResource) {
    const confirmed = window.confirm(
      `Remove the review by "${review.reviewer_name || "Student"}" from "${review.resource_title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", review.id);

    if (error) {
      console.error("Review deletion error:", error);
      setMessage(`Could not remove review: ${error.message}`);
      return;
    }

    setReviews((current) =>
      current.filter((item) => item.id !== review.id)
    );

    setMessage("Review removed.");
  }

  function statusLabel(status: string) {
    if (status === "approved") return "APPROVED";
    if (status === "hidden") return "HIDDEN";
    return "PENDING";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">StudyShelf Admin</h1>
            <p className="text-sm text-slate-500">
              Manage submitted study resources
            </p>
          </div>

          <a
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            View StudyShelf
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <div className="mb-6 rounded-xl border bg-white px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-bold">Resources</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review, approve, reject, hide, or remove resources.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            Loading resources...
          </div>
        ) : resources.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <h3 className="font-semibold">No resources to manage</h3>
            <p className="mt-2 text-sm text-slate-500">
              New submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          resource.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : resource.status === "hidden"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {statusLabel(resource.status)}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {resource.type}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold">{resource.title}</h3>

                    <p className="mt-2 text-sm text-slate-600">
                      {resource.subject} • {resource.grade}
                      {resource.topic ? ` • ${resource.topic}` : ""}
                    </p>

                    {resource.description && (
                      <p className="mt-3 text-sm text-slate-600">
                        {resource.description}
                      </p>
                    )}

                    <div className="mt-4 text-xs text-slate-500">
                      Uploaded by: {resource.uploader_name || "Anonymous"}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      ID: {resource.id}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      Preview
                    </a>

                    {resource.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            updateStatus(resource.id, "approved")
                          }
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            updateStatus(resource.id, "rejected")
                          }
                          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {resource.status === "approved" && (
                      <button
                        onClick={() => updateStatus(resource.id, "hidden")}
                        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Hide
                      </button>
                    )}

                    {resource.status === "hidden" && (
                      <button
                        onClick={() =>
                          updateStatus(resource.id, "approved")
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Unhide
                      </button>
                    )}

                    <button
                      onClick={() => removeResource(resource)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mb-6 mt-14">
          <h2 className="text-xl font-bold">Reviews</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage student reviews submitted on resources.
          </p>
        </div>

        {reviewsLoading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <h3 className="font-semibold">No reviews yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Student reviews will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Review for
                    </p>

                    <h3 className="mt-1 text-lg font-bold">
                      {review.resource_title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="font-semibold">
                        {review.reviewer_name || "Anonymous"}
                      </span>

                      <span className="text-lg tracking-wide">
                        <span className="text-yellow-400">
                          {"★".repeat(review.rating)}
                        </span>
                        <span className="text-slate-300">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>

                      <span className="text-sm text-slate-500">
                        {review.rating}/5
                      </span>
                    </div>

                    {review.review_text && (
                      <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {review.review_text}
                      </p>
                    )}

                    <div className="mt-3 text-xs text-slate-400">
                      Review ID: {review.id} • Resource ID:{" "}
                      {review.resource_id}
                    </div>
                  </div>

                  <button
                    onClick={() => removeReview(review)}
                    className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Remove Review
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}