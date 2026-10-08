"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("");
  const [uploaderName, setUploaderName] = useState("");

  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");

    if (!file) {
      setMessage("Please choose a file.");
      return;
    }

    if (!title || !grade || !subject || !type) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setIsUploading(true);

    try {
      // Create a unique file name
      const fileExtension = file.name.split(".").pop() || "pdf";

      const safeFileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExtension}`;

      // Upload the file to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("resources")
        .upload(safeFileName, file);

      if (storageError) {
        console.error("SUPABASE STORAGE ERROR:", storageError);

        setMessage(
          "File upload failed: " + JSON.stringify(storageError)
        );

        setIsUploading(false);
        return;
      }

      // Get the public URL of the uploaded file
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("resources")
        .getPublicUrl(safeFileName);

      // Save the resource information in the database
      // IMPORTANT: We do NOT use .select() here.
      const { error: databaseError } = await supabase
        .from("resources")
        .insert({
          title: title,
          description: description,
          grade: grade,
          subject: subject,
          topic: topic,
          type: type,
          file_url: publicUrl,
          uploader_name: uploaderName,
          status: "pending",
        });

      if (databaseError) {
        console.error("SUPABASE DATABASE ERROR:", databaseError);

        setMessage(
          "Database error: " + JSON.stringify(databaseError)
        );

        setIsUploading(false);
        return;
      }

      // Everything worked!
      setMessage(
        "Success! Your resource has been submitted for admin approval."
      );

      // Clear the form
      setFile(null);
      setTitle("");
      setDescription("");
      setGrade("");
      setSubject("");
      setTopic("");
      setType("");
      setUploaderName("");

      // Reset the file input
      const fileInput = document.getElementById(
        "file"
      ) as HTMLInputElement;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error("UNEXPECTED ERROR:", error);

      setMessage(
        "Something went wrong: " + JSON.stringify(error)
      );
    }

    setIsUploading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </a>

          <h1 className="mt-6 text-4xl font-bold text-gray-900">
            Upload a Resource
          </h1>

          <p className="mt-2 text-gray-600">
            Share your notes, assignments, practice questions, or
            other study resources with students.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleUpload}
          className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >
          {/* File */}
          <div>
            <label
              htmlFor="file"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Resource File *
            </label>

            <input
              id="file"
              type="file"
              onChange={(e) =>
                setFile(e.target.files?.[0] || null)
              }
              className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
            />

            <p className="mt-2 text-xs text-gray-500">
              Upload a PDF, document, presentation, or image.
            </p>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Title *
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Grade 9 Biology Chapter 4 Notes"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Description
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what is included..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* Grade */}
          <div>
            <label
              htmlFor="grade"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Grade *
            </label>

            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-3"
            >
              <option value="">Select grade</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="subject"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Subject *
            </label>

            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: Biology"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* Topic */}
          <div>
            <label
              htmlFor="topic"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Topic
            </label>

            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Example: Chapter 4 - Cells"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* Type */}
          <div>
            <label
              htmlFor="type"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Resource Type *
            </label>

            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-3"
            >
              <option value="">Select type</option>
              <option value="Notes">Notes</option>
              <option value="Assignment">Assignment</option>
              <option value="Practice">Practice</option>
              <option value="Flashcards">Flashcards</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="uploaderName"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Your Name
            </label>

            <input
              id="uploaderName"
              type="text"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder="Example: Alan"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {/* Copyright notice */}
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            <strong>Before uploading:</strong> Only share resources
            that you created yourself or have permission to share.
            Please do not upload textbooks, paid worksheets, teacher
            materials, or copyrighted files without permission.
          </div>

          {/* Message */}
          {message && (
            <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-800">
              {message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isUploading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isUploading ? "Uploading..." : "Submit Resource"}
          </button>
        </form>
      </div>
    </main>
  );
}