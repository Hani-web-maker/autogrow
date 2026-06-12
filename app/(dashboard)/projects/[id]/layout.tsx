import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProjectSidebar } from "@/components/layout/project-sidebar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, orgId: session?.user?.orgId || "" },
    select: { id: true, clientName: true },
  });

  if (!project) notFound();

  return (
    <div className="flex p-8 gap-8 max-w-7xl mx-auto w-full">
      <ProjectSidebar projectId={project.id} clientName={project.clientName} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
