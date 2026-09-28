import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/env';

export async function GET(
  request: NextRequest,
  { params }: { params: { invitationId: string; imageId: string } }
): Promise<NextResponse> {
  const cookie = request.headers.get('cookie');
  try {
    const response = await fetch(
      `${getApiUrl().replace(/\/$/, '')}/invitations/${encodeURIComponent(params.invitationId)}/images/${encodeURIComponent(params.imageId)}/content`,
      { cache: 'no-store', headers: cookie ? { cookie } : undefined }
    );
    if (!response.ok) return new NextResponse(null, { status: response.status });
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
