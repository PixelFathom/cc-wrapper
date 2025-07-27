import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of public routes that don't require authentication
const publicRoutes = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Get the token from cookies (Next.js middleware can't access localStorage)
  const token = request.cookies.get('access_token')?.value
  
  // If the route is protected and there's no token, redirect to login
  if (!isPublicRoute && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // If user is logged in and tries to access login page, redirect to home
  if (isPublicRoute && token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}