import { redirect } from "next/navigation";

import { getCurrentSessionUser } from "@/backend/auth/session";

export default async function HomePage(): Promise<never> {
  const currentUser = await getCurrentSessionUser();
  redirect(currentUser ? "/reports" : "/login");
}
