import { NextResponse } from 'next/server';
export function proxy() {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
    '/auth/:path*',
    '/api/events/:path*',
    '/api/covers/:path*',
  ],
};
