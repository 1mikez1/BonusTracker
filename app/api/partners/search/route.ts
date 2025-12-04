import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Force dynamic rendering since we use request.headers for rate limiting
export const dynamic = 'force-dynamic';

function sanitizeSearchInput(input: string, maxLength: number = 100): string {
  return input.trim().slice(0, maxLength);
}

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { 
          error: {
            message: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            details: 'Please wait before making another request'
          }
        },
        { status: 429 }
      );
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { 
          error: {
            message: 'Supabase client not available',
            code: 'SERVICE_UNAVAILABLE'
          }
        },
        { status: 500 }
      );
    }

    // Get query parameter with validation
    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('query') || '';
    const query = sanitizeSearchInput(rawQuery, 100);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 20); // Between 1 and 20

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Search partners by name (case-insensitive)
    const { data, error } = await supabase
      .from('client_partners')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .limit(limit)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error searching partners:', error);
      return NextResponse.json(
        { 
          error: {
            message: 'Failed to search partners',
            code: 'DATABASE_ERROR',
            details: error.message
          }
        },
        { status: 500 }
      );
    }

    // Format response for autocomplete
    const items = (data || []).map((partner: any) => ({
      id: partner.id,
      displayName: partner.name
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/partners/search:', error);
    return NextResponse.json(
      { 
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      },
      { status: 500 }
    );
  }
}

