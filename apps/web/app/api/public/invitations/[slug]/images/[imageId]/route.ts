import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/env';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string; imageId: string } }
): Promise<NextResponse> {
  try {
    const response = await fetch(
      `${getApiUrl().replace(/\/$/, '')}/public/invitations/${encodeURIComponent(params.slug)}/images/${encodeURIComponent(params.imageId)}/content`,
      { next: { revalidate: 300 } }
    );
    if (!response.ok) return new NextResponse(null, { status: response.status });
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
