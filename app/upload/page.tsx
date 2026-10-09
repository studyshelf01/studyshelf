
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Suggestions = {
  title: string;
  grade: string;
  subject: string;
  topic: string;
  type: string;
};

type Chapter = {
  number: string;
  title: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .trim();
}

function detectGrade(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /\b(?:grade|class|std|standard)\s*(7|8|9|10|11|12)\b/
  );

  if (match) return `Grade ${match[1]}`;

  const romanMatch = normalized.match(
    /\b(?:grade|class|standard)\s*(viii|vii|xii|xi|ix|x)\b/
  );

  if (romanMatch) {
    const grades: Record<string, string> = {
      vii: "Grade 7",
      viii: "Grade 8",
      ix: "Grade 9",
      x: "Grade 10",
      xi: "Grade 11",
      xii: "Grade 12",
    };

    return grades[romanMatch[1]] || "";
  }

  const filenameGrade = normalized.match(
    /\b(7|8|9|10|11|12)\s*(?:th|st|nd|rd)?\s*grade\b/
  );

  if (filenameGrade) return `Grade ${filenameGrade[1]}`;
  return "";
}

const SUBJECTS = [
  "Informatics Practices",
  "Computer Science",
  "Business Studies",
  "Social Science",
  "Political Science",
  "Environmental Science",
  "Mathematics",
  "Accountancy",
  "Economics",
  "Psychology",
  "Geography",
  "Biology",
  "Chemistry",
  "Physics",
  "History",
  "English",
  "Hindi",
  "Science",
];

function detectSubject(text: string) {
  const normalized = normalizeText(text);

  const patterns: Record<string, RegExp> = {
    "Informatics Practices": /\binformatics practices\b/,
    "Computer Science": /\bcomputer science\b/,
    "Business Studies": /\bbusiness studies\b/,
    "Social Science": /\bsocial science\b/,
    "Political Science": /\bpolitical science\b/,
    "Environmental Science": /\benvironmental science\b/,
    Mathematics: /\bmathematics\b|\bmaths\b|\bmath\b/,
    Accountancy: /\baccountancy\b|\baccounting\b/,
    Economics: /\beconomics\b/,
    Psychology: /\bpsychology\b/,
    Geography: /\bgeography\b/,
    Biology: /\bbiology\b/,
    Chemistry: /\bchemistry\b/,
    Physics: /\bphysics\b/,
    History: /\bhistory\b/,
    English: /\benglish\b/,
    Hindi: /\bhindi\b/,
    Science: /\bscience\b/,
  };

  return SUBJECTS.find((subject) => patterns[subject]?.test(normalized)) || "";
}

function cleanChapterTitle(value: string) {
  return value
    .replace(/^[\s:–—-]+/, "")
    .replace(/[.,;:\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFilename(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function romanToNumber(value: string): number | null {
  const roman = value.toUpperCase();

  if (/^\d+$/.test(roman)) {
    const number = Number(roman);
    return number >= 1 && number <= 99 ? number : null;
  }

  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  if (!/^[IVXLCDM]+$/.test(roman)) return null;

  let total = 0;

  for (let i = 0; i < roman.length; i++) {
    const current = values[roman[i]];
    const next = values[roman[i + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total >= 1 && total <= 99 ? total : null;
}

function detectChapterFromFilename(fileName: string): Chapter | null {
  const name = cleanFilename(fileName);

  const pattern =
    /\b(?:chapter|chap|ch)\.?\s*0?(\d{1,2}|[ivxlcdm]{1,8})\b\s*[-:.)–—]?\s*(.*)$/i;

  const match = name.match(pattern);

  if (match) {
    const number = romanToNumber(match[1]);
    const title = cleanChapterTitle(match[2] || "");

    if (number !== null) {
      return {
        number: String(number),
        title: title.length >= 3 ? toTitleCase(title) : "",
      };
    }
  }

  const subject = detectSubject(name);

  if (subject) {
    const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const subjectPattern = new RegExp(
      `\\b${escapedSubject}\\b\\s+0?(\\d{1,2})\\s+(.+)$`,
      "i"
    );
    const subjectMatch = name.match(subjectPattern);

    if (subjectMatch) {
      const number = Number(subjectMatch[1]);
      const title = cleanChapterTitle(subjectMatch[2]);

      if (number >= 1 && number <= 99 && title.length >= 3) {
        return { number: String(number), title: toTitleCase(title) };
      }
    }
  }

  const leadingNumber = name.match(/^\s*0?(\d{1,2})\s+(.+)$/);

  if (leadingNumber) {
    const number = Number(leadingNumber[1]);
    const remainder = leadingNumber[2];
    const detectedSubject = detectSubject(remainder);

    if (number >= 1 && number <= 99 && detectedSubject) {
      const escapedSubject = detectedSubject.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const title = cleanChapterTitle(
        remainder.replace(new RegExp(`\\b${escapedSubject}\\b`, "i"), "")
      );

      if (title.length >= 3) {
        return { number: String(number), title: toTitleCase(title) };
      }
    }
  }

  return null;
}

const GENERIC_HEADINGS =
  /^(?:syllabus(?:\s+boundary|\s+scope)?|contents|table of contents|scope|study method|objectives|revision|references|index|complete chapter theory|definitions and key terms|how to use this guide|chapter summary|answer key|solutions|bibliography|acknowledgements?)\b/i;

function isBoilerplateLine(line: string) {
  const normalized = normalizeText(line);

  if (!normalized || normalized.length < 3) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (GENERIC_HEADINGS.test(line)) return true;

  if (
    /\b(?:detailed|ncert aligned|study companion|study guide)\b/i.test(line) &&
    /\b(?:notes|theory|resource|guide|companion)\b/i.test(line)
  ) {
    return true;
  }

  if (/\b(?:page|copyright|all rights reserved|www\.|http|email)\b/i.test(line)) {
    return true;
  }

  if (
    /\b(?:cbse|class|grade|standard|academic year|session)\b/i.test(line) &&
    /\b(?:\d{4}|\bvi{1,3}\b|\bix\b|\bxii?\b)\b/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

function detectRealChapterTitle(text: string, subject: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const normalizedSubject = normalizeText(subject);

  for (const rawLine of lines.slice(0, 25)) {
    const line = cleanChapterTitle(
      rawLine.replace(/^[\d.]+\s*/, "").replace(/^[•–—-]\s*/, "")
    );

    if (isBoilerplateLine(line)) continue;
    if (normalizedSubject && normalizeText(line) === normalizedSubject) continue;
    if (/^(?:chapter|chap|ch)\.?\s*\d+\s*$/i.test(line)) continue;
    if (line.length < 4 || line.length > 110) continue;
    if (/[.!?]$/.test(line)) continue;

    if (
      /\b(?:syllabus scope|study method|table of contents|contents and how|learning objectives)\b/i.test(line)
    ) {
      continue;
    }

    return toTitleCase(line);
  }

  return "";
}

function detectChapterInText(text: string): Chapter | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const pattern =
    /^\s*(?:chapter|chap\.?|ch\.?)\s*(\d{1,2}|[ivxlcdm]{1,8})\s*(?:[-:.)–—]\s*)?(.*)$/i;

  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;

    const number = romanToNumber(match[1]);
    if (number === null) continue;

    let title = cleanChapterTitle(match[2] || "");

    if (!title || isBoilerplateLine(title)) {
      const nextLine = lines[i + 1] || "";

      if (
        nextLine.length >= 3 &&
        nextLine.length <= 110 &&
        !/^(?:chapter|chap\.?|ch\.?)\s*\d+/i.test(nextLine) &&
        !isBoilerplateLine(nextLine)
      ) {
        title = cleanChapterTitle(nextLine);
      }
    }

    return {
      number: String(number),
      title: title.length >= 3 ? toTitleCase(title) : "",
    };
  }

  return null;
}

function resolveChapter(
  fileName: string,
  pdfText: string,
  firstPageText: string
): Chapter | null {
  const filenameChapter = detectChapterFromFilename(fileName);
  const firstPageChapter = detectChapterInText(firstPageText);
  const documentChapter = detectChapterInText(pdfText);

  if (filenameChapter?.title) return filenameChapter;
  if (firstPageChapter?.title) return firstPageChapter;
  if (documentChapter?.title) return documentChapter;
  if (filenameChapter) return filenameChapter;
  if (firstPageChapter) return firstPageChapter;

  return documentChapter;
}

function buildTopic(chapter: Chapter | null, subject: string) {
  if (!chapter?.number || !chapter.title || !subject) return "";
  return `${subject} Chapter ${chapter.number} – ${chapter.title}`;
}

function suggestTitle(fileName: string, firstPageText: string) {
  const cleanedName = cleanFilename(fileName)
    .replace(/\s*-\s*/g, " - ")
    .trim();

  const genericName =
    /^(document|file|scan|scanned|untitled|download|pdf|notes?)\s*\d*$/i;

  if (cleanedName && !genericName.test(cleanedName)) {
    return toTitleCase(cleanedName);
  }

  const firstLine = firstPageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length >= 4 &&
        line.length <= 100 &&
        !/^\d+$/.test(line) &&
        !isBoilerplateLine(line)
    );

  return firstLine || "";
}

function buildTitle(
  chapter: Chapter | null,
  grade: string,
  subject: string,
  fileName: string,
  firstPageText: string
) {
  const gradeNumber = grade.match(/\d+/)?.[0];

  if (chapter?.number && chapter.title && gradeNumber && subject) {
    return `CBSE Class ${gradeNumber} ${subject} Chapter ${chapter.number} – ${chapter.title}`;
  }

  if (chapter?.number && chapter.title && subject) {
    return `${subject} Chapter ${chapter.number} – ${chapter.title}`;
  }

  return suggestTitle(fileName, firstPageText);
}

function detectType(fileName: string, firstPageText: string, pdfText: string) {
  const filename = normalizeText(fileName.replace(/\.[^.]+$/, ""));
  const firstLines = firstPageText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");

  const firstPage = normalizeText(firstPageText);
  const body = normalizeText(pdfText);

  const scores: Record<string, number> = {
    Notes: 0,
    Assignment: 0,
    Practice: 0,
    Flashcards: 0,
  };

  const rules: Record<string, { pattern: RegExp; points: number }[]> = {
    Notes: [
      { pattern: /\b(?:revision notes|study notes|class notes|lecture notes)\b/, points: 5 },
      { pattern: /\bnotes\b/, points: 4 },
      { pattern: /\b(?:study guide|summary)\b/, points: 3 },
    ],
    Assignment: [
      { pattern: /\b(?:assignment|homework|classwork)\b/, points: 5 },
    ],
    Practice: [
      {
        pattern: /\b(?:practice worksheet|practice paper|question paper|sample paper|past paper|previous year questions|pyq|question bank|worksheet)\b/,
        points: 5,
      },
      { pattern: /\bpractice\b/, points: 4 },
    ],
    Flashcards: [{ pattern: /\bflashcards?\b/, points: 5 }],
  };

  for (const [typeName, typeRules] of Object.entries(rules)) {
    for (const rule of typeRules) {
      if (rule.pattern.test(filename)) scores[typeName] += rule.points;
      if (rule.pattern.test(firstLines)) scores[typeName] += rule.points;
    }
  }

  if (/\bnotes\b/.test(firstPage)) scores.Notes += 1;
  if (/\bassignment\b/.test(firstPage)) scores.Assignment += 1;
  if (/\b(?:practice|exercises|worksheet)\b/.test(firstPage)) scores.Practice += 1;
  if (/\bflashcards?\b/.test(firstPage)) scores.Flashcards += 1;

  if (/\bnotes\b/.test(body)) scores.Notes += 1;
  if (/\bassignment\b/.test(body)) scores.Assignment += 1;
  if (/\b(?:practice|exercises|worksheet)\b/.test(body)) scores.Practice += 1;
  if (/\bflashcards?\b/.test(body)) scores.Flashcards += 1;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0];

  if (!best || best[1] < 4) return "";
  if (ranked[1] && ranked[1][1] === best[1]) return "";

  return best[0];
}

function detectMetadata(
  fileName: string,
  pdfText: string,
  firstPageText: string
): Suggestions {
  const grade = detectGrade(fileName) || detectGrade(pdfText);
  const subject = detectSubject(fileName) || detectSubject(pdfText);
  const chapter = resolveChapter(fileName, pdfText, firstPageText);

  const realTitle =
    chapter?.title ||
    detectRealChapterTitle(firstPageText, subject) ||
    detectRealChapterTitle(pdfText, subject);

  const effectiveChapter =
    chapter && realTitle ? { ...chapter, title: realTitle } : chapter;

  return {
    title: buildTitle(effectiveChapter, grade, subject, fileName, firstPageText),
    grade,
    subject,
    topic: buildTopic(effectiveChapter, subject),
    type: detectType(fileName, firstPageText, pdfText),
  };
}

export default function UploadPage() {
  const router = useRouter();

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
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [canUpload, setCanUpload] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/student-login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          router.replace("/student-login");
          return;
        }

        // Allow active students and active admins (including the owner).
        if (
          profile.status !== "active" ||
          (profile.role !== "student" && profile.role !== "admin")
        ) {
          await supabase.auth.signOut();
          router.replace("/student-login");
          return;
        }

        if (!cancelled) setCanUpload(true);
      } catch (error) {
        console.error("UPLOAD ACCESS CHECK ERROR:", error);
        await supabase.auth.signOut();
        router.replace("/student-login");
      } finally {
        if (!cancelled) setIsCheckingAccess(false);
      }
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;

    setFile(selectedFile);
    setMessage("");

    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) return;

    setTitle("");
    setGrade("");
    setSubject("");
    setTopic("");
    setType("");

    setIsDetecting(true);
    setMessage("Reading PDF and looking for metadata...");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

      const fileData = new Uint8Array(await selectedFile.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;

      const pageTexts: string[] = [];
      const pagesToRead = Math.min(pdf.numPages, 5);

      for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        let pageText = "";
        let previousY: number | null = null;

        for (const item of content.items) {
          if (!("str" in item)) continue;

          const y = item.transform[5];

          if (pageText) {
            pageText +=
              previousY !== null && Math.abs(y - previousY) > 3 ? "\n" : " ";
          }

          pageText += item.str;
          previousY = y;
        }

        pageTexts.push(pageText);
      }

      const pdfText = pageTexts.join("\n");
      const firstPageText = pageTexts[0] || "";

      const suggestions = detectMetadata(
        selectedFile.name,
        pdfText,
        firstPageText
      );

      if (suggestions.title) setTitle(suggestions.title);
      if (suggestions.grade) setGrade(suggestions.grade);
      if (suggestions.subject) setSubject(suggestions.subject);
      if (suggestions.topic) setTopic(suggestions.topic);
      if (suggestions.type) setType(suggestions.type);

      const detectedFields: string[] = [];
      if (suggestions.title) detectedFields.push("title");
      if (suggestions.grade) detectedFields.push("grade");
      if (suggestions.subject) detectedFields.push("subject");
      if (suggestions.topic) detectedFields.push("topic");
      if (suggestions.type) detectedFields.push("resource type");

      setMessage(
        detectedFields.length
          ? `PDF analyzed. Suggested ${detectedFields.join(", ")}. Please review the fields before submitting.`
          : "PDF analyzed, but no reliable metadata suggestions were found. Please fill in the fields manually."
      );
    } catch (error) {
      console.error("PDF METADATA DETECTION ERROR:", error);
      setMessage(
        "The PDF was selected, but its text could not be analyzed automatically. You can fill in the fields manually."
      );
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isDetecting) {
      setMessage("Please wait for PDF analysis to finish.");
      return;
    }

    setMessage("");

    if (!file) {
      setMessage("Please choose a file.");
      return;
    }

    if (!title.trim() || !grade || !subject.trim() || !type) {
      setMessage("Please fill in all required fields.");
      return;
    }

    setIsUploading(true);

    let uploadedFilePath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/student-login");
        return;
      }

      // Recheck role and status immediately before upload.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        (profile.role !== "student" && profile.role !== "admin") ||
        profile.status !== "active"
      ) {
        setMessage("Your account is not permitted to upload resources.");
        return;
      }

      const fileExtension = file.name.split(".").pop() || "pdf";
      const safeFileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExtension}`;

      const { error: storageError } = await supabase.storage
        .from("resources")
        .upload(safeFileName, file);

      if (storageError) {
        console.error("SUPABASE STORAGE ERROR:", storageError);
        setMessage(`File upload failed: ${storageError.message}`);
        return;
      }

      uploadedFilePath = safeFileName;

      const {
        data: { publicUrl },
      } = supabase.storage.from("resources").getPublicUrl(safeFileName);

      const { error: databaseError } = await supabase.from("resources").insert({
        title: title.trim(),
        description: description.trim() || null,
        grade,
        subject: subject.trim(),
        topic: topic.trim() || null,
        type,
        file_url: publicUrl,
        uploader_name: uploaderName.trim() || null,
        user_id: user.id,
        status: "pending",
      });

      if (databaseError) {
        console.error("SUPABASE DATABASE ERROR:", databaseError);

        // Clean up the uploaded file if saving its database row failed.
        const { error: cleanupError } = await supabase.storage
          .from("resources")
          .remove([safeFileName]);

        if (cleanupError) {
          console.error("UPLOAD CLEANUP ERROR:", cleanupError);
        }

        uploadedFilePath = null;
        setMessage(`Database error: ${databaseError.message}`);
        return;
      }

      uploadedFilePath = null;
      setMessage("Success! Your resource has been submitted for admin approval.");

      setFile(null);
      setTitle("");
      setDescription("");
      setGrade("");
      setSubject("");
      setTopic("");
      setType("");
      setUploaderName("");

      const fileInput = document.getElementById("file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("UNEXPECTED UPLOAD ERROR:", error);

      // Best-effort cleanup if an unexpected error occurred after file upload.
      if (uploadedFilePath) {
        const { error: cleanupError } = await supabase.storage
          .from("resources")
          .remove([uploadedFilePath]);

        if (cleanupError) {
          console.error("UPLOAD CLEANUP ERROR:", cleanupError);
        }
      }

      setMessage("Something went wrong while uploading. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  if (isCheckingAccess || !canUpload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
        <p className="text-center text-gray-600">
          Checking your account permissions...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
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
            Share your notes, assignments, practice questions, or other study
            resources with students.
          </p>
        </div>

        <form
          onSubmit={handleUpload}
          className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >
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
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
              required
            />

            <p className="mt-2 text-xs text-gray-500">
              Upload a PDF, document, presentation, or image.
            </p>
          </div>

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
              placeholder="Example: CBSE Class 12 Biology Chapter 2 – Human Reproduction"
              required
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

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
              required
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
              required
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

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
              placeholder="Example: Biology Chapter 2 – Human Reproduction"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

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
              required
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
              placeholder="Example: Anonymous"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            <strong>Before uploading:</strong> Only share resources that you
            created yourself or have permission to share. Please do not upload
            textbooks, paid worksheets, teacher materials, or copyrighted files
            without permission.
          </div>

          {message && (
            <div
              role="status"
              className="rounded-lg bg-gray-100 p-4 text-sm text-gray-800"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || isDetecting || isCheckingAccess}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isDetecting
              ? "Analyzing PDF..."
              : isUploading
                ? "Uploading..."
                : "Submit Resource"}
          </button>
        </form>
      </div>
    </main>
  );
}
