import { requireAdmin } from "@/lib/guards";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { TeacherForm } from "@/components/TeacherForm";
import { getParam, type SearchParams } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function NewTeacherPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();
  const error = getParam(searchParams, "error");

  return (
    <>
      <PageHeader
        title="新增教师"
        description="创建教师档案与登录账号，初始密码可后续修改。"
      />
      <Alert error={error} />
      <TeacherForm mode="create" />
    </>
  );
}
