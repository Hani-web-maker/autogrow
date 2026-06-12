import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-[#4F8EF7]/10 rounded-3xl flex items-center justify-center mx-auto">
          <FileSearch className="w-10 h-10 text-[#4F8EF7]" />
        </div>
        <div>
          <p className="text-6xl font-bold text-[#4F8EF7] mb-2">404</p>
          <h1 className="text-2xl font-bold text-[#0f172a] mb-2">Page not found</h1>
          <p className="text-[#64748b] text-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline">View Projects</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
