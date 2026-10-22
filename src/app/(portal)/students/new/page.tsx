import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { StudentForm } from "@/components/StudentForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const error = getParam(searchParams, "error");

  const [classes, parents] = await Promise.all([
    prisma.schoolClass.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PARENT" },
      select: { id: true, name: true, phone: true, username: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="新增幼儿档案"
        description="录入幼儿基本信息并关联家长账号，后续可随时修改。"
      />
      <Alert error={error} />
      <StudentForm mode="create" classes={classes} parents={parents} />
    </>
  );
}
