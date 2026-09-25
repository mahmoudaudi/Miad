import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/env';

const forwardedHeaders = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
];

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  const apiBase = getApiUrl().replace(/\/$/, '');
  const response = await fetch(
    `${apiBase}/public/invitations/${encodeURIComponent(params.slug)}/render`,
    { cache: 'no-store' }
  );
  const body = await response.text();
  if (!response.ok) {
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') ?? 'text/plain' },
    });
  }
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const name of forwardedHeaders) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new NextResponse(body, { status: response.status, headers });
}
