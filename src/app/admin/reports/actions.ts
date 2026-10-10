"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/server/admin";
import { dismissReport, takeDownReportedPage } from "@/server/moderation";

// Each action re-checks admin rights itself — src/app/admin/layout.tsx does
// not run for a Server Action POST. (The /admin IP allowlist in
// src/middleware.ts does: actions post to the page's own URL.)

function reportIdFrom(formData: FormData): string {
  const id = formData.get("reportId");
  if (typeof id !== "string" || !id) notFound();
  return id;
}

export async function takeDownAction(formData: FormData): Promise<void> {
  if (!(await isAdminRequest())) notFound();
  await takeDownReportedPage(reportIdFrom(formData));
  revalidatePath("/admin/reports");
}

export async function dismissAction(formData: FormData): Promise<void> {
  if (!(await isAdminRequest())) notFound();
  await dismissReport(reportIdFrom(formData));
  revalidatePath("/admin/reports");
}
