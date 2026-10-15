import { NextRequest } from "next/server";
import { proxyAuthPost } from "../../../../lib/auth-post-proxy";

export async function POST(req: NextRequest) {
  return proxyAuthPost(req, "/api/auth/reset-password");
}
