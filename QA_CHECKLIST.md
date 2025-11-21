# QA Checklist - BH Referral & Bonus Management Web App

**Last Updated**: 2025-01-XX  
**Purpose**: Comprehensive manual QA checklist for frontend validation before and after Task 5 (Frontend Roadmap)  
**Status**: Baseline QA (Pre-Task 5)

---

## 📋 Quick Reference

### Dashboard Pages
- `/` - Homepage (Mission Control)
- `/clients` - Clients List
- `/clients/[id]` - Client Detail
- `/apps` - Apps List
- `/promotions` - Promotions List
- `/pipeline` - Pipeline (Kanban)
- `/requests` - Requests List
- `/referral-links` - Referral Links
- `/debts` - Debts
- `/payment-links` - Payment Links
- `/slots` - Slots
- `/message-templates` - Message Templates

---

## 🔧 Pre-Task 5: Baseline QA (Current State)

### Prerequisites
- [ ] Start dev server: `npm run dev`
- [ ] Log in via Supabase Auth (authenticated user)
- [ ] Open browser DevTools (Console + Network tabs)
- [ ] Clear browser cache if needed

---

### 1. Homepage (`/` - app/page.tsx)

#### 1.1 Basic Loading
- [ ] Page loads without JS errors in console
- [ ] LoadingSpinner appears during initial load
- [ ] No "undefined" or "null" values displayed
- [ ] Sidebar navigation works

#### 1.2 Key Metrics Cards
- [ ] **Active clients** card shows correct count
  - **Expected**: ~41 (trusted clients)
  - **Verify**: Cross-check with `/clients` page filtered by `trusted = true`
- [ ] **Apps in pipeline** card shows correct count
  - **Expected**: ~507 (client_apps with status != cancelled/paid)
  - **Verify**: Cross-check with `/pipeline` page total
- [ ] **Open debts** card shows correct total
  - **Expected**: €0.00 (no open debts currently)
  - **Verify**: Cross-check with `/debts` page filtered by status = open/partial
- [ ] **Pending requests** card shows correct count
  - **Expected**: Count of requests with status = 'new'
  - **Verify**: Cross-check with `/requests` page filtered by status = new

#### 1.3 Operational Focus Section
- [ ] **Today's onboarding** displays correctly
  - Shows apps registered today, grouped by app name
  - Format: "AppName xCount" or "None"
- [ ] **Upcoming expirations** shows correct count
  - Counts promotions ending within 48h
  - Format: "X promotion(s) ending within 48h"
- [ ] **Money in transit** shows correct total
  - Sum of unused payment links amounts
  - Format: "€X.XX pending across Y payment link(s)"

#### 1.4 Navigation
- [ ] "Open clients" button navigates to `/clients`
- [ ] "Process requests" button navigates to `/requests`
- [ ] Metric cards are clickable and navigate to respective pages

**Issues Found**: _________________________

---

### 2. Clients List (`/clients`)

#### 2.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails (test by breaking network)
- [ ] EmptyState appears if no clients (unlikely, but test edge case)

#### 2.2 Data Display
- [ ] Table shows ~188 clients
- [ ] Columns display correctly:
  - Name (name + surname)
  - Contact (may be NULL - expected)
  - Email (may be NULL - expected)
  - Trusted (boolean badge)
  - Tier (may be NULL - expected, no tiers assigned yet)
  - Total Apps (count)
  - Total Profit (sum of profit_us)
  - Statuses (status distribution)
- [ ] No raw UUIDs displayed (names shown instead)

#### 2.3 Filtering & Search
- [ ] **Tier filter** works:
  - "All" shows all clients
  - Specific tier filters correctly (when tiers are assigned)
- [ ] **Trusted filter** works:
  - "All" shows all clients
  - "Trusted" shows only trusted clients (~41)
  - "Not Trusted" shows non-trusted clients
- [ ] **Status filter** works (if implemented)
- [ ] **Search** works:
  - Search by name/surname
  - Search by contact (if available)
  - Search is case-insensitive

#### 2.4 Pagination
- [ ] Pagination controls appear if > 25 clients
- [ ] Page navigation works (next/previous)
- [ ] Page size selector works (if implemented)
- [ ] Current page resets when filters change

#### 2.5 Navigation
- [ ] Clicking a row navigates to `/clients/[id]`
- [ ] "New Signup" button opens NewSignupModal (if present)

**Issues Found**: _________________________

---

### 3. Client Detail (`/clients/[id]`)

#### 3.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if client not found
- [ ] URL parameter `[id]` is correctly parsed

#### 3.2 Personal Information Section
- [ ] **Name & Surname** display correctly
- [ ] **Contact** displays (may be NULL - expected)
- [ ] **Email** displays (may be NULL - expected)
- [ ] **Trusted** badge shows correct state
- [ ] **Tier** displays (may be NULL - expected)
- [ ] **Invited By** shows inviter name (if exists)
- [ ] **Notes** display correctly (no technical flags visible)

#### 3.3 Financial Summary Section
- [ ] **Money Redeemed** calculates correctly
  - Sum of profit_client for paid client_apps
  - Verify: Check a few paid apps manually
- [ ] **Total Deposited** calculates correctly
  - Sum of deposit_amount for paid client_apps
  - Verify: Check a few paid apps manually
- [ ] **Our Profit** calculates correctly
  - Sum of profit_us for paid client_apps
  - Verify: Check a few paid apps manually
- [ ] **Owed to Client** calculates correctly
  - Sum from referral_link_debts where client is creditor
- [ ] **Owed by Client** calculates correctly
  - Sum from referral_link_debts where client is debtor
- [ ] Values are formatted as currency (€X.XX)
- [ ] Zero values display as €0.00 (not hidden)

#### 3.4 Apps Started Section
- [ ] Lists all client_apps for this client
- [ ] Each app card shows:
  - App name
  - Status badge
  - Referral link (if present)
  - Deposit amount
  - Client profit (from promotion if NULL)
  - Internal profit (from promotion if NULL)
  - Started date
  - Deposited checkbox
  - Finished checkbox
- [ ] **Edit** button opens edit form
- [ ] **Delete** button appears in edit form (with confirmation)
- [ ] **Mark as Paid** button appears for completed apps
- [ ] Status automatically updates when Deposited/Finished checkboxes are toggled
- [ ] **Incomplete Steps** section shows only uncompleted steps
- [ ] **Edit Steps** button allows toggling completed/incomplete steps
- [ ] Step completion updates client_app status automatically

#### 3.5 Available Apps Not Started
- [ ] Shows only apps with active promotions
- [ ] Does not show apps already started by this client
- [ ] "Start an app process" button works
- [ ] NewSignupModal opens with correct initial app_id

#### 3.6 Credentials Section (if present)
- [ ] Lists credentials for this client
- [ ] Shows app name (not UUID)
- [ ] Username/email displayed correctly

#### 3.7 Debts Section (if present)
- [ ] Lists debts where client is creditor or debtor
- [ ] Shows correct amounts and statuses

#### 3.8 Payment Links Section (if present)
- [ ] Lists payment links for this client
- [ ] Shows used/unused status correctly

#### 3.9 Edit Functionality
- [ ] Edit personal info works and persists
- [ ] Edit app details works and persists
- [ ] Profit fields are pre-filled from promotion
- [ ] Changes are saved to database
- [ ] UI updates immediately after save

**Issues Found**: _________________________

---

### 4. Apps List (`/apps`)

#### 4.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no apps (unlikely)

#### 4.2 Data Display
- [ ] Table shows all apps (~28 apps)
- [ ] Columns display correctly:
  - App Name
  - Type
  - Country
  - Active Status (clearly distinguishable)
  - Active Bonus (promotion status)
  - Total Clients (count)
  - Total Profit (sum)
  - Referral Links (count)
- [ ] **Active apps** are clearly marked (is_active = true)
- [ ] **Inactive apps** are clearly marked (is_active = false)
- [ ] **Active bonus** indicator reflects promotion.is_active correctly

#### 4.3 Filtering
- [ ] **Type filter** works (if app_type is populated)
- [ ] **Active filter** works:
  - "All" shows all apps
  - "Active" shows only is_active = true (~8 apps)
  - "Inactive" shows only is_active = false (~20 apps)
- [ ] **Bonus filter** works (if implemented)

#### 4.4 Metrics
- [ ] **Total Apps** count is correct
- [ ] **Active Apps** count matches filter
- [ ] **Total Referral Links** count is correct

#### 4.5 Actions
- [ ] "New Signup" button opens NewSignupModal
- [ ] "Add signup" button per app row opens NewSignupModal with app_id pre-filled
- [ ] Clicking app row navigates to app detail (if implemented)

**Issues Found**: _________________________

---

### 5. Promotions List (`/promotions`)

#### 5.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no promotions

#### 5.2 Data Display
- [ ] Table shows all promotions (~17 promotions)
- [ ] Columns display correctly:
  - Promotion Name
  - App Name (not UUID)
  - Client Reward
  - Our Reward
  - Deposit Required
  - Active Status
  - Start/End Dates
- [ ] **Active promotions** are clearly marked
- [ ] **Expired promotions** are clearly marked (based on dates + is_active)

#### 5.3 Edit Functionality (if implemented)
- [ ] Inline editing works
- [ ] Editing promotion triggers backend automation
  - **Test**: Edit a promotion's client_reward/our_reward
  - **Verify**: Check linked client_apps - profits should update automatically
- [ ] Changes persist after refresh

#### 5.4 Filtering & Search
- [ ] Filter by app works
- [ ] Filter by active status works
- [ ] Search works (if implemented)

**Issues Found**: _________________________

---

### 6. Pipeline (`/pipeline`)

#### 6.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no client_apps

#### 6.2 Column Structure
- [ ] All 7 columns are present:
  - requested
  - registered
  - deposited
  - waiting_bonus
  - completed
  - paid
  - cancelled
- [ ] Column headers are readable
- [ ] Column widths are reasonable

#### 6.3 Card Display
- [ ] Each card shows:
  - Client name (not UUID)
  - App name (not UUID)
  - Deposit amount (if available)
  - Status badge
- [ ] Cards are visually distinct
- [ ] Cards are clickable (navigate to client detail)

#### 6.4 Drag & Drop (if implemented)
- [ ] Drag a card between columns works
- [ ] UI updates instantly (optimistic update)
- [ ] After refresh, new status persists
- [ ] On error, UI rolls back correctly

#### 6.5 Filtering
- [ ] **App filter** works
- [ ] **Search** works (by client name, app name, notes)

#### 6.6 Actions
- [ ] "New Signup" button opens NewSignupModal

**Issues Found**: _________________________

---

### 7. Requests (`/requests`)

#### 7.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no requests

#### 7.2 Data Display
- [ ] Table shows all requests
- [ ] **Requester** column shows full name (name + surname)
  - For converted requests: shows linked client name
  - For new requests: shows name from request data
- [ ] **Name is clickable** and navigates to client profile (if client exists)
- [ ] Columns display correctly:
  - Requester (clickable if client exists)
  - Contact
  - Requested Apps
  - Status
  - Created At
  - Actions

#### 7.3 Actions
- [ ] **"New Signup"** button opens NewSignupModal
- [ ] **"Convert to signup"** button (for new requests):
  - Opens NewSignupModal
  - Pre-fills name and contact from request
  - Creates client + client_apps
  - Updates request status to 'converted'
- [ ] **"Add Client Profile"** button (if present):
  - Opens form with tier selection
  - Creates client successfully
  - Shows Toast notification (not alert)

#### 7.4 Filtering & Search
- [ ] Filter by status works
- [ ] Search works (by name, contact)

**Issues Found**: _________________________

---

### 8. Referral Links (`/referral-links`)

#### 8.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no referral links

#### 8.2 Data Display
- [ ] Table shows all referral links (~67 links)
- [ ] Columns display correctly:
  - App Name (not UUID)
  - URL (clickable if valid)
  - Owner (may be NULL - expected)
  - Current Uses / Max Uses
  - Active Status
- [ ] Links without URL are either:
  - Hidden, OR
  - Clearly marked as non-clickable/non-usable
- [ ] URL column is clickable (opens in new tab)

#### 8.3 Filtering & Search
- [ ] Filter by app works
- [ ] Filter by active status works
- [ ] Search works (if implemented)

**Issues Found**: _________________________

---

### 9. Debts (`/debts`)

#### 9.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no debts (expected: 0 debts currently)

#### 9.2 Data Display
- [ ] Table shows all debts (currently 0)
- [ ] Columns display correctly:
  - App Name (from referral_link)
  - Creditor Name (not UUID)
  - Debtor Name (not UUID)
  - Amount (formatted as currency)
  - Status
  - Description
  - Created At
  - Settled At (if settled)

#### 9.3 Status Management (if implemented)
- [ ] Status change works (e.g., mark as settled)
- [ ] Changes persist after refresh

#### 9.4 Filtering & Search
- [ ] Filter by status works
- [ ] Filter by creditor works
- [ ] Filter by debtor works
- [ ] Search works (if implemented)

**Issues Found**: _________________________

---

### 10. Payment Links (`/payment-links`)

#### 10.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no payment links

#### 10.2 Data Display
- [ ] Table shows all payment links
- [ ] Columns display correctly:
  - Provider
  - URL (clickable)
  - Amount (formatted as currency)
  - Purpose
  - Client Name (not UUID, if present)
  - App Name (not UUID, if present)
  - Used/Unused Status
  - Created At
  - Used At (if used)

#### 10.3 Used Links Handling
- [ ] Used links are clearly marked
- [ ] Used links are NOT presented as available in flows where they shouldn't be

#### 10.4 Filtering & Search
- [ ] Filter by provider works
- [ ] Filter by used/unused works
- [ ] Search works (if implemented)

**Issues Found**: _________________________

---

### 11. Slots (`/slots`)

#### 11.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no slots

#### 11.2 Data Display
- [ ] Table shows all slots
- [ ] Columns display correctly:
  - Name
  - Provider
  - RTP Percentage
  - Notes

#### 11.3 Sorting
- [ ] Sorting by RTP percentage works
- [ ] Data looks plausible (RTP between 0-100%)

**Issues Found**: _________________________

---

### 12. Message Templates (`/message-templates`)

#### 12.1 Basic Loading
- [ ] Page loads without JS errors
- [ ] LoadingSpinner appears during load
- [ ] ErrorMessage appears if data fetch fails
- [ ] EmptyState appears if no templates

#### 12.2 Apps Grid
- [ ] Shows apps that have templates
- [ ] Apps without templates are either hidden or shown as empty
- [ ] Clicking an app shows its templates

#### 12.3 Onboard Section
- [ ] Generic templates (app_id = NULL) appear in "Onboard" section
- [ ] Should show ~7 templates:
  - Spiegazione + registrazione modulo
  - Spiegazione + registrazione modulo LIGHT
  - Prenotazione FUP
  - registrazione
  - pagamento
  - prelievo dep nostro
  - prelievo dep loro

#### 12.4 App-Specific Templates
- [ ] Selecting an app (e.g., REVOLUT, BBVA, KRAKEN) shows templates
- [ ] Templates are grouped by `step`
- [ ] Within each step, templates are ordered by `step_order`
- [ ] Copy-to-clipboard button works on each template
- [ ] Content is displayed correctly (no truncation)

#### 12.5 Edge Cases
- [ ] Page handles apps with no templates gracefully
- [ ] No errors in browser console
- [ ] Loading states work correctly

**Issues Found**: _________________________

---

## 🚀 Post-Task 5: Advanced QA (After Frontend Roadmap)

### Prerequisites
- [ ] Task 5 (Frontend Roadmap) is completed:
  - Relationship joins implemented
  - Loading/error/empty states integrated
  - Pagination implemented
  - Server-side filtering implemented
  - Optimistic updates implemented
  - Realtime subscriptions implemented (if applicable)

---

### 13. Relationship Joins Verification

#### 13.1 No Broken Joins
- [ ] No "loading forever" states
- [ ] No "undefined" data displayed
- [ ] No console errors about missing relationships
- [ ] All pages use PostgREST relationship joins (check Network tab)

#### 13.2 Join Syntax Verification
- [ ] Check Network tab: queries use `select=*,related_table(*)` syntax
- [ ] No N+1 queries (multiple separate requests for related data)
- [ ] Data loads in single request where possible

**Test Pages**:
- [ ] `/clients` - clients with tiers, invited_by
- [ ] `/clients/[id]` - client with apps, promotions, debts
- [ ] `/apps` - apps with promotions, client_apps, referral_links
- [ ] `/pipeline` - client_apps with apps, clients
- [ ] `/requests` - requests with clients

**Issues Found**: _________________________

---

### 14. UI States Verification

#### 14.1 Loading States
- [ ] **Every page** shows LoadingSpinner during initial data fetch
- [ ] LoadingSpinner appears during mutations (create/update/delete)
- [ ] LoadingSpinner is properly positioned and styled

#### 14.2 Error States
- [ ] **Every page** shows ErrorMessage on data fetch failure
- [ ] ErrorMessage includes retry button
- [ ] Retry button actually retries the failed request
- [ ] Error messages are user-friendly (not raw error objects)

#### 14.3 Empty States
- [ ] **Every page** shows EmptyState when no data exists
- [ ] EmptyState messages are contextual and helpful
- [ ] EmptyState includes action buttons where appropriate (e.g., "Create first client")

**Test Pages**:
- [ ] All 12 dashboard pages tested

**Issues Found**: _________________________

---

### 15. Server-Side Filtering Verification

#### 15.1 Filter Performance
- [ ] Filters feel snappy (no noticeable delay)
- [ ] Network requests include filter parameters (check DevTools Network tab)
- [ ] Filters are applied server-side (not client-side in-memory)

#### 15.2 Filter Persistence
- [ ] Filter state persists in URL query params (if implemented)
- [ ] Page refresh maintains filter state
- [ ] Browser back/forward maintains filter state

#### 15.3 Search Performance
- [ ] Search is applied server-side
- [ ] Search results update quickly
- [ ] Search parameters visible in Network requests

**Test Pages**:
- [ ] `/clients` - tier, trusted, status filters
- [ ] `/apps` - type, active, bonus filters
- [ ] `/pipeline` - app filter, search
- [ ] `/requests` - status filter, search

**Issues Found**: _________________________

---

### 16. Optimistic Updates Verification

#### 16.1 Instant UI Updates
- [ ] Status changes (e.g., pipeline drag & drop) update instantly
- [ ] Edits (e.g., client info, app details) update instantly
- [ ] Creates (e.g., new client, new signup) appear instantly
- [ ] Deletes remove items instantly

#### 16.2 Error Rollback
- [ ] On mutation failure, UI rolls back to previous state
- [ ] Error message is displayed
- [ ] User can retry the operation

#### 16.3 Persistence Verification
- [ ] After optimistic update, refresh page
- [ ] Changes persist in database
- [ ] UI matches database state

**Test Flows**:
- [ ] Pipeline: Drag card between columns
- [ ] Client Detail: Edit app details
- [ ] Requests: Convert to signup
- [ ] Promotions: Edit promotion (verify trigger updates client_apps)

**Issues Found**: _________________________

---

### 17. Realtime Subscriptions Verification (if implemented)

#### 17.1 Multi-Window Test
- [ ] Open app in two browser windows
- [ ] Make a change in Window 1 (e.g., update client_app status)
- [ ] Verify Window 2 updates automatically (without refresh)
- [ ] Make a change in Window 2
- [ ] Verify Window 1 updates automatically

#### 17.2 Realtime Events
- [ ] New client_app created → appears in pipeline automatically
- [ ] Client_app status changed → moves to correct column automatically
- [ ] Request converted → status updates automatically
- [ ] Promotion updated → client_app profits update automatically (via trigger)

#### 17.3 Performance
- [ ] Realtime updates don't cause performance issues
- [ ] No excessive re-renders
- [ ] Updates are smooth (no flickering)

**Issues Found**: _________________________

---

## 📊 Cross-Page Consistency Checks

### 18. Data Consistency

#### 18.1 Metric Cross-Checks
- [ ] Homepage "Active clients" = `/clients` filtered by trusted
- [ ] Homepage "Apps in pipeline" = `/pipeline` total count
- [ ] Homepage "Open debts" = `/debts` filtered by open/partial
- [ ] Homepage "Pending requests" = `/requests` filtered by new

#### 18.2 Financial Summary Cross-Checks
- [ ] Client detail "Money Redeemed" = Sum of profit_client for paid apps
- [ ] Client detail "Our Profit" = Sum of profit_us for paid apps
- [ ] Client detail "Total Deposited" = Sum of deposit_amount for paid apps
- [ ] Values match when calculated manually

#### 18.3 Status Consistency
- [ ] Client_app status in `/clients/[id]` matches `/pipeline` column
- [ ] Request status in `/requests` matches after conversion
- [ ] Promotion active status in `/promotions` matches `/apps` "Active bonus"

**Issues Found**: _________________________

---

## 🔄 End-to-End Workflow Tests

### 19. New Signup Flow

#### 19.1 From Apps Page
- [ ] Click "Add signup" on an app row
- [ ] NewSignupModal opens with app_id pre-filled
- [ ] Step 1: Search/create client works
- [ ] Step 2: Select promotion, referral link, add notes
- [ ] Submit creates client_app with status = 'requested'
- [ ] New client_app appears in `/pipeline` "requested" column
- [ ] New client_app appears in `/clients/[id]` "Apps Started" section

#### 19.2 From Pipeline Page
- [ ] Click "New Signup" button
- [ ] NewSignupModal opens (no app pre-filled)
- [ ] Complete flow works as above

#### 19.3 From Requests Page
- [ ] Click "Convert to signup" on a new request
- [ ] NewSignupModal opens with name/contact pre-filled
- [ ] Complete flow works
- [ ] Request status updates to 'converted'

**Issues Found**: _________________________

---

### 20. Promotion Update Flow

#### 20.1 Edit Promotion
- [ ] Go to `/promotions`
- [ ] Edit a promotion's client_reward or our_reward
- [ ] Save changes

#### 20.2 Verify Trigger
- [ ] Check linked client_apps (status = completed/paid)
- [ ] Verify profit_client and profit_us updated automatically
- [ ] Verify changes persist after refresh

**Issues Found**: _________________________

---

### 21. Client App Status Progression

#### 21.1 Manual Status Change
- [ ] Go to `/clients/[id]`
- [ ] Find a client_app with status = 'registered'
- [ ] Toggle "Deposited" checkbox
- [ ] Verify status updates to 'deposited' (or appropriate status)
- [ ] Toggle "Finished" checkbox
- [ ] Verify status updates to 'completed' (or appropriate status)

#### 21.2 Pipeline Drag & Drop
- [ ] Go to `/pipeline`
- [ ] Drag a card from "registered" to "deposited"
- [ ] Verify UI updates instantly
- [ ] Refresh page
- [ ] Verify status persisted in database

**Issues Found**: _________________________

---

## 🐛 Common Issues to Watch For

### 22. Data Display Issues
- [ ] Raw UUIDs displayed instead of names
- [ ] NULL values displayed as "null" or "undefined"
- [ ] Currency not formatted (shows raw numbers)
- [ ] Dates not formatted (shows ISO strings)
- [ ] Missing data where relationships should exist

### 23. Performance Issues
- [ ] Pages load slowly (> 2 seconds)
- [ ] Filters cause noticeable delay
- [ ] Multiple unnecessary network requests
- [ ] Excessive re-renders (check React DevTools)

### 24. UX Issues
- [ ] No feedback on user actions (no loading/error states)
- [ ] Confusing error messages
- [ ] Broken navigation links
- [ ] Forms don't validate input
- [ ] No confirmation for destructive actions

**Issues Found**: _________________________

---

## 📝 QA Session Template

### Session Information
- **Date**: _______________
- **Tester**: _______________
- **Environment**: Local Dev / Staging / Production
- **Browser**: Chrome / Firefox / Safari / Edge
- **Task 5 Status**: Before / After

### Test Results Summary
- **Pages Tested**: ___ / 12
- **Critical Issues**: ___
- **Medium Issues**: ___
- **Low Issues**: ___
- **Overall Status**: ✅ Pass / ⚠️ Pass with Issues / ❌ Fail

### Critical Issues Log
1. **Page**: _______________
   **Issue**: _______________
   **Steps to Reproduce**: _______________
   **Expected**: _______________
   **Actual**: _______________

2. **Page**: _______________
   **Issue**: _______________
   **Steps to Reproduce**: _______________
   **Expected**: _______________
   **Actual**: _______________

### Notes
- _______________
- _______________
- _______________

---

## ✅ Acceptance Criteria Checklist

### Pre-Task 5
- [ ] All pages load without fatal errors
- [ ] All pages show either real data or sane empty states
- [ ] Homepage metrics roughly match other pages
- [ ] Core workflows work end-to-end (new signup, convert request, change status, edit promotion)

### Post-Task 5
- [ ] All pages use relationship joins (no N+1 queries)
- [ ] All pages have LoadingSpinner, ErrorMessage, EmptyState
- [ ] Server-side filtering/search works and feels snappy
- [ ] Optimistic updates work (instant UI, rollback on error)
- [ ] Realtime subscriptions work (multi-window test passes)

---

## 🔄 Re-Testing Schedule

### When to Re-Run QA
- [ ] After any major feature addition
- [ ] After any database migration
- [ ] Before production deployment
- [ ] After Task 5 completion
- [ ] Monthly maintenance check

### Quick Smoke Test (5 minutes)
1. [ ] Homepage loads and shows metrics
2. [ ] Clients page loads and shows ~188 clients
3. [ ] One client detail page loads correctly
4. [ ] Pipeline page loads and shows cards
5. [ ] No console errors on any page

---

**Last QA Session**: _______________  
**Next Scheduled QA**: _______________  
**Maintained By**: Development Team

