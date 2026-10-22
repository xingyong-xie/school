import { ApiError, handle, readJson, stringField } from "@/lib/api";
import { signSession } from "@/lib/auth";
import { ok } from "@/lib/json";
import { authenticate } from "@/lib/services/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const username = stringField(body, "username", { max: 64 });
    const password = stringField(body, "password", { max: 128, trim: false });

    const user = await authenticate(username, password);
    if (!user) {
      throw new ApiError("UNAUTHORIZED", "账号或密码不正确", 401);
    }

    const { token, exp } = signSession(user);
    return ok({
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      user,
    });
  });
}
