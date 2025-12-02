# FT001: Partner Filter for Clients - Quick Test Guide

## Overview
This feature allows filtering the Clients list by partner name with autocomplete support.

## Manual Test Steps

### 1. Autocomplete Functionality
- Navigate to `/clients`
- Click on the "Filter by partner" input field
- Type a partial partner name (e.g., "Marco")
- **Expected**: Dropdown appears within 300ms showing matching partners
- Select a partner from the dropdown
- **Expected**: Input field shows the selected partner name with green border
- **Expected**: Client list filters to show only clients assigned to that partner

### 2. Free-text Partner Search
- Clear the partner filter (click × button)
- Type a full partner name directly (e.g., "Marco Michieletto")
- Press Enter or wait for debounce
- **Expected**: Client list filters to show clients with matching partner name (case-insensitive)

### 3. Combined Filters
- Set partner filter to a specific partner
- Set tier filter to a specific tier
- Set status filter to "completed"
- **Expected**: Only clients matching ALL filters are shown (AND logic)

### 4. Partner Column Navigation
- In the clients table, find a client with a partner assigned
- Click on the partner name in the "Partner" column
- **Expected**: Navigates to `/partners/[partner_id]` showing partner detail page

### 5. Pagination Reset
- Apply partner filter
- Navigate to page 2 or 3
- Change the partner filter
- **Expected**: Pagination resets to page 1

### 6. Performance Test
- Open browser DevTools → Network tab
- Apply partner filter
- **Expected**: API response time < 2 seconds

## API Testing (curl examples)

### Search Partners (Autocomplete)
```bash
curl "http://localhost:3000/api/partners/search?query=marco&limit=10"
```

**Expected Response:**
```json
{
  "items": [
    { "id": "uuid", "displayName": "Marco Michieletto" }
  ]
}
```

### Get Clients by Partner
```bash
curl "http://localhost:3000/api/partners/[partner-id]/clients?search=&limit=25&offset=0&order_by=created_at&order_dir=desc"
```

**Expected Response:**
```json
{
  "items": [...clients],
  "total": 10,
  "page": 1,
  "per_page": 25,
  "has_more": false
}
```

## Edge Cases to Test

1. **Invalid Partner ID**: Try accessing `/api/partners/invalid-uuid/clients`
   - **Expected**: 400 Bad Request with error message

2. **Rate Limiting**: Make 11 rapid requests to `/api/partners/search`
   - **Expected**: 429 Too Many Requests on 11th request

3. **Empty Search**: Search with empty query
   - **Expected**: Returns empty items array

4. **Very Long Search**: Search with > 100 characters
   - **Expected**: Input truncated to 100 characters

5. **No Partner Assigned**: Filter by partner when client has no partner
   - **Expected**: Client not shown in filtered results

## Known Issues
None at this time.

## Rollback Instructions
See `rollback/FT001_rollback_instructions.md`

