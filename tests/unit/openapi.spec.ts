import { test, expect } from "@playwright/test";
import { buildOpenApi, schemaExamples, PageDetailResponseSchema, ListPagesResponseSchema, ApiErrorSchema } from "booklet-api-client";
import { GET } from "@/app/api/v1/openapi.json/route";

test("GET /api/v1/openapi.json serves an OpenAPI 3.1 document covering every v1 operation", async () => {
  const res = GET();
  expect(res.headers.get("content-type")).toContain("application/json");
  const doc = await res.json();
  expect(doc.openapi).toBe("3.1.0");
  const ops = Object.entries(doc.paths as Record<string, Record<string, { operationId: string }>>).flatMap(([, methods]) =>
    Object.values(methods).map((o) => o.operationId),
  );
  expect(ops).toEqual(expect.arrayContaining(["publishPage", "listPages", "getPage", "updatePage", "deletePage"]));
  expect(doc.components.schemas.PageDetail.properties.raw).toBeTruthy();
  expect(doc).toEqual(JSON.parse(JSON.stringify(buildOpenApi(doc.info.version))));
});

test("the documented examples satisfy the schemas the clients validate with", () => {
  expect(() => PageDetailResponseSchema.parse(schemaExamples("PageDetail")[0])).not.toThrow();
  expect(() => ListPagesResponseSchema.parse(schemaExamples("ListPagesResponse")[0])).not.toThrow();
  expect(() => ApiErrorSchema.parse(schemaExamples("Problem")[0])).not.toThrow();
  expect(schemaExamples("PatchPageRequest")).toHaveLength(4); // the docs page indexes these
});
