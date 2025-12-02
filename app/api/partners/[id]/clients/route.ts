import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseClient';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function sanitizeSearchInput(input: string, maxLength: number = 100): string {
  return input.trim().slice(0, maxLength);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partnerId = params.id;
    
    // Validate partner_id is a valid UUID
    if (partnerId && !isValidUUID(partnerId)) {
      return NextResponse.json(
        { 
          error: {
            message: 'Invalid partner ID format',
            code: 'INVALID_PARTNER_ID',
            details: 'Partner ID must be a valid UUID'
          }
        },
        { status: 400 }
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

    // Get query parameters with validation
    const searchParams = request.nextUrl.searchParams;
    const rawSearch = searchParams.get('search') || '';
    const rawPartnerNameSearch = searchParams.get('partner') || '';
    const orderBy = searchParams.get('order_by') || 'created_at';
    const orderDir = searchParams.get('order_dir') || 'desc';
    
    // Sanitize and validate search inputs
    const search = sanitizeSearchInput(rawSearch, 100);
    const partnerNameSearch = sanitizeSearchInput(rawPartnerNameSearch, 100);
    
    // Validate and sanitize limit and offset
    const rawLimit = searchParams.get('limit');
    const rawOffset = searchParams.get('offset');
    const limit = Math.min(Math.max(parseInt(rawLimit || '25', 10) || 25, 1), 100); // Between 1 and 100
    const offset = Math.max(parseInt(rawOffset || '0', 10) || 0, 0); // Minimum 0

    // Validate order_by and order_dir
    const validOrderBy = ['created_at', 'name'].includes(orderBy) ? orderBy : 'created_at';
    const validOrderDir = ['asc', 'desc'].includes(orderDir) ? orderDir : 'desc';

    // Call the SQL function
    const { data, error } = await supabase.rpc('get_clients_by_partner', {
      in_partner_id: partnerId || null,
      in_partner_name_search: partnerNameSearch || null,
      in_search: search || null,
      in_limit: limit,
      in_offset: offset,
      in_order_by: validOrderBy,
      in_order_dir: validOrderDir
    } as any);

    if (error) {
      console.error('Error fetching clients by partner:', error);
      return NextResponse.json(
        { 
          error: {
            message: 'Failed to fetch clients',
            code: 'DATABASE_ERROR',
            details: error.message
          }
        },
        { status: 500 }
      );
    }

    // Get total count for pagination
    // We'll use a simpler count query
    let totalCount = 0;
    if (data && Array.isArray(data)) {
      // For now, we'll use the length of results
      // In production, you might want a separate count query
      totalCount = data.length;
    }

    return NextResponse.json({
      items: data || [],
      total: totalCount,
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      has_more: (data?.length || 0) === limit
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/partners/[id]/clients:', error);
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

