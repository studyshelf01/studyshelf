"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Resource = {
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

type Review = {
  id: number;
  created_at: string;
  reviewer_name: string | null;
  rating: number;
  review_text: string | null;
};

export default function ResourcePage() {
  const params = useParams();
  const id = params.id as string;

  const [resource, setResource] = useState<Resource | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadResource() {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("id", id)
        .eq("status", "approved")
        .single();

      if (error || !data) {
        setMessage("Resource not found.");
        setLoading(false);
        return;
      }

      setResource(data);

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("*")
        .eq("resource_id", id)
        .order("created_at", { ascending: false });

      setReviews(reviewData || []);
      setLoading(false);
    }

    loadResource();
  }, [id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    if (!reviewerName.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    if (!reviewText.trim()) {
      setMessage("Please write a review.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        resource_id: Number(id),
        reviewer_name: reviewerName.trim(),
        rating,
        review_text: reviewText.trim(),
      })
      .select()
      .single();

    if (error) {
      setMessage("Could not submit your review. Please try again.");
      setSubmitting(false);
      return;
    }

    setReviews((current) => [data, ...current]);
    setReviewerName("");
    setReviewText("");
    setRating(5);
    setMessage("Review submitted!");
    setSubmitting(false);
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading resource...</p>
      </main>
    );
  }

  if (!resource) {
    return (
      <main className="min-h-screen bg-slate-50">
        <nav className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <Link
              href="/"
              className="text-xl font-bold text-slate-900"
            >
              StudyShelf
            </Link>
          </div>
        </nav>

        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Resource not found
          </h1>
          <p className="mt-3 text-slate-600">
            This resource may have been removed or hidden.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Back to StudyShelf
          </Link>
        </div>
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

          <Link
            href="/upload"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Upload Resource
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to resources
        </Link>

        <section className="mt-6 rounded-3xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
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

              <h1 className="mt-4 text-3xl font-bold text-slate-900">
                {resource.title}
              </h1>

              {resource.description && (
                <p className="mt-4 text-slate-600">
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
            </div>

            <div className="rounded-2xl bg-slate-50 px-6 py-5 text-center">
              <div className="text-3xl font-bold text-slate-900">
                {averageRating > 0 ? averageRating.toFixed(1) : "—"}
              </div>

              <div className="mt-1 text-lg">
                {reviews.length > 0 ? "⭐".repeat(Math.round(averageRating)) : "☆☆☆☆☆"}
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {reviews.length}{" "}
                {reviews.length === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>

          <a
            href={resource.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Open PDF
          </a>
        </section>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Leave a Review
            </h2>

            <form onSubmit={submitReview} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Your name
                </label>

                <input
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Rating
                </label>

                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setRating(number)}
                      className={`text-3xl ${
                        number <= rating
                          ? "text-yellow-400"
                          : "text-slate-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Review
                </label>

                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Was this resource helpful?"
                  rows={4}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>

              {message && (
                <p className="text-sm text-slate-600">{message}</p>
              )}
            </form>
          </div>

          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Student Reviews
            </h2>

            {reviews.length === 0 ? (
              <p className="mt-6 text-slate-500">
                No reviews yet. Be the first to review this resource!
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b pb-5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-slate-900">
                        {review.reviewer_name || "Student"}
                      </p>

                      <span className="text-yellow-400">
                        {"★".repeat(review.rating)}
                        <span className="text-slate-300">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                    </div>

                    {review.review_text && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {review.review_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}