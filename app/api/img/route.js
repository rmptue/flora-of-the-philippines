// Image proxy: the Cornell herbarium serves photos over HTTP only, which browsers block
// as mixed content on our HTTPS site. This route fetches the image server-side and re-serves
// it over HTTPS, cached aggressively at Vercel's edge so each image is fetched upstream once.

export const runtime = "nodejs";

const ALLOWED_HOST = "herbarium.bh.cornell.edu";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });

  let target;
  try {
    target = new URL(u);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  // Only allow the herbarium image directory — don't become an open proxy.
  if (target.hostname !== ALLOWED_HOST || !target.pathname.startsWith("/CUBIC_IMAGES/")) {
    return new Response("forbidden", { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (flora-of-the-philippines image relay)" },
      signal: controller.signal,
    });
    if (!res.ok) return new Response("upstream " + res.status, { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("relay error", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
