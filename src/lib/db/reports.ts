import { getDb } from "@/lib/mongodb";
import { createId } from "@/lib/id";
import type { DbReport } from "./types";

type ReportDoc = Omit<DbReport, "id"> & { _id: string; resolved_at?: string };

function toReport(doc: ReportDoc): DbReport {
  return {
    id: doc._id,
    page_id: doc.page_id,
    reason: doc.reason,
    detail: doc.detail ?? null,
    reporter_email: doc.reporter_email ?? null,
    created_at: doc.created_at,
    status: doc.status,
  };
}

export async function createReport(
  input: Pick<DbReport, "page_id" | "reason" | "detail" | "reporter_email">,
): Promise<DbReport> {
  const doc: ReportDoc = {
    _id: createId(16),
    ...input,
    created_at: new Date().toISOString(),
    status: "open",
  };
  const db = await getDb();
  await db.collection<ReportDoc>("reports").insertOne(doc);
  return toReport(doc);
}

export async function listOpenReports(limit = 200): Promise<DbReport[]> {
  const db = await getDb();
  const docs = await db
    .collection<ReportDoc>("reports")
    .find({ status: "open" })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toReport);
}

export async function countOpenReports(): Promise<number> {
  const db = await getDb();
  return db.collection<ReportDoc>("reports").countDocuments({ status: "open" });
}

export async function getReport(id: string): Promise<DbReport | null> {
  if (typeof id !== "string") return null;
  const db = await getDb();
  const doc = await db.collection<ReportDoc>("reports").findOne({ _id: id });
  return doc ? toReport(doc) : null;
}

/** Closes one open report. Returns false if it was not open. */
export async function resolveReport(id: string, status: "actioned" | "dismissed"): Promise<boolean> {
  if (typeof id !== "string") return false;
  const db = await getDb();
  const res = await db
    .collection<ReportDoc>("reports")
    .updateOne({ _id: id, status: "open" }, { $set: { status, resolved_at: new Date().toISOString() } });
  return res.modifiedCount === 1;
}

/** Closes every open report for a page — used when the page is taken down. */
export async function resolveReportsForPage(pageId: string, status: "actioned" | "dismissed"): Promise<void> {
  const db = await getDb();
  await db
    .collection<ReportDoc>("reports")
    .updateMany({ page_id: pageId, status: "open" }, { $set: { status, resolved_at: new Date().toISOString() } });
}
