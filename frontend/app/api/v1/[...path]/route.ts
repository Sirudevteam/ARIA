import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getTargetBaseUrl(): string {
  const target =
    process.env.BACKEND_URL ||
    process.env.INTERNAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";
  return target.replace(/\/$/, "");
}

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendBase = getTargetBaseUrl();
  const searchParams = request.nextUrl.search;
  const targetUrl = `${backendBase}/api/v1/${path.join("/")}${searchParams}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!["host", "connection", "content-length"].includes(lowerKey)) {
      forwardHeaders.set(key, value);
    }
  });

  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const res = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
      // @ts-expect-error duplex required for streaming in Node fetch
      duplex: "half",
    });

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!["content-encoding"].includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[API Proxy Error] Failed to reach backend at ${targetUrl}:`, errorMessage);
    return NextResponse.json(
      {
        detail: `Failed to reach backend at ${backendBase}. Please configure BACKEND_URL in Railway environment variables. (${errorMessage})`,
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
