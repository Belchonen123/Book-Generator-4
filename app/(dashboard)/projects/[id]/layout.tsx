import { ProjectNav } from "./_components/project-nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="container mx-auto py-6">
      <ProjectNav bookId={id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
