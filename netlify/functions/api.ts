/**
 * Thin Netlify Functions wrapper that proxies to the existing Vercel-style handler.
 * No duplicated logic — just adapts the Netlify event shape to what api/index.ts expects.
 */
import type { Handler } from "@netlify/functions";
import vercelHandler from "../../api/index";

const handler: Handler = async (event: any) => {
  // Build a minimal req/res pair that the Vercel handler understands
  const path = event.path.replace("/.netlify/functions/api", "/api");

  const req: any = {
    method: event.httpMethod,
    url: path,
    headers: event.headers,
    body: event.body ? JSON.parse(event.body) : undefined,
  };

  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  let resBody = "";

  const res: any = {
    setHeader(key: string, value: string) { resHeaders[key] = value; return res; },
    status(code: number) { statusCode = code; return res; },
    json(data: any) { resBody = JSON.stringify(data); return res; },
    end() { return res; },
  };

  await vercelHandler(req, res);

  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...resHeaders },
    body: resBody,
  };
};

export { handler };
