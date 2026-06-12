"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a] mb-2">Something went wrong</h1>
              <p className="text-[#64748b] text-sm">
                An unexpected error occurred. Please try again or contact support if the problem persists.
              </p>
              {error.digest && (
                <p className="text-xs text-[#94a3b8] mt-2">Error ID: {error.digest}</p>
              )}
            </div>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
