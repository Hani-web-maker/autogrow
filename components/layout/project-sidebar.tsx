"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Plug, CheckSquare, FileText, Settings, ArrowLeft } from "lucide-react";

interface ProjectSidebarProps {
  projectId: string;
  clientName: string;
}

export function ProjectSidebar({ projectId, clientName }: ProjectSidebarProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const items = [
    { label: "Overview", href: base, icon: LayoutDashboard },
    { label: "Integrations", href: `${base}/integrations`, icon: Plug },
    { label: "Tasks", href: `${base}/tasks`, icon: CheckSquare },
    { label: "Reports", href: `${base}/reports`, icon: FileText },
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ];

  return (
    <div className="w-52 flex-shrink-0">
      <div className="mb-4">
        <Link
          href="/projects"
          className="flex items-center gap-2 text-xs text-[#64748b] hover:text-[#0f172a] transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          All Projects
        </Link>
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider px-2">Project</p>
        <p className="text-sm font-semibold text-[#0f172a] px-2 mt-0.5 truncate">{clientName}</p>
      </div>

      <nav className="space-y-0.5">
        {items.map(({ label, href, icon: Icon }) => {
          const active = href === base ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#4F8EF7]/10 text-[#4F8EF7]"
                  : "text-[#64748b] hover:bg-[#F8F9FA] hover:text-[#0f172a]"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
