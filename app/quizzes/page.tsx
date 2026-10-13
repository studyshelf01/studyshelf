import { Suspense } from "react";
import QuizzesClient from "./QuizzesClient";

export default function QuizzesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="mt-4 text-sm font-medium text-slate-600">
              Getting your quizzes ready...
            </p>
          </div>
        </main>
      }
    >
      <QuizzesClient />
    </Suspense>
  );
}
