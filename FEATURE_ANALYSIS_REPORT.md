# FEATURE ANALYSIS REPORT
## Complete Feature Request Analysis - BonusTracker

---

## 1. CLIENTS

### 1.1 Filter by Partner Name
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Free-text search filter for partner name implemented in `/clients` page
- Uses `partnerFilter` state and `selectedPartnerId` for exact matching
- Filter logic in `filteredRows` useMemo (lines 221-233 in `app/(dashboard)/clients/page.tsx`)
- Supports both ID-based and name-based filtering
- SQL function `get_clients_with_partner_filter` available for backend filtering

**Implementation Location**:
- `app/(dashboard)/clients/page.tsx` (lines 89-94, 221-233)
- `app/api/partners/[id]/clients/route.ts`
- `supabase/migrations/0042_add_partner_filter_indexes.sql`

---

### 1.2 Sort by Creation Date
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Sorting functionality implemented with `sortColumn` and `sortDirection` state
- Default sort column is `'created_at'` (line 98 in `app/(dashboard)/clients/page.tsx`)
- `handleSort` function supports toggling between ascending/descending
- Database index `idx_clients_created_at` exists for performance
- Sort logic in `filteredRows` useMemo (lines 244-255)

**Implementation Location**:
- `app/(dashboard)/clients/page.tsx` (lines 98, 244-255)
- `supabase/migrations/0042_add_partner_filter_indexes.sql` (index creation)

---

### 1.3 Separate Active/Inactive Started Apps in Client View
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Active and inactive started apps are separated in client detail page
- `activeStartedApps` and `inactiveStartedApps` computed separately
- Toggle button to show/hide inactive apps (`showInactiveStartedApps` state)
- Inactive apps are hidden by default but not deleted
- Apps are filtered based on associated app's `is_active` status and active promotions

**Implementation Location**:
- `app/(dashboard)/clients/[id]/page.tsx` (lines 2287-2306, 2501-2506, 3637-3657)
- Logic separates apps into:
  - `activeStartedApps`: apps with `status = 'started'` AND associated app is active
  - `inactiveStartedApps`: apps with `status = 'started'` AND associated app is inactive
  - `otherApps`: all other statuses

---

## 2. PARTNERS

### 2.1 Update Partner "Due" on "Completed" Instead of "Paid"
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Partner balance now updates when app is marked as "completed" (not "paid")
- Changed trigger from `status = 'paid'` → `status = 'completed'`
- Partner profit split calculation now updates earlier in the workflow
- This allows partners to be paid in advance before the app is marked as "paid"

**Implementation**:
- Modified `statusContributes` in `lib/partners.ts` to only include `'completed'` (was `['completed', 'paid']`)
- Updated filter in partner detail page to show only `'completed'` apps in the breakdown
- Partner payments can still be tracked separately via `partner_payments` table
- The "Mark as Paid" functionality in partner page still works independently

**Implementation Location**:
- `lib/partners.ts` (line 27): Changed `statusContributes` from `Set(['completed', 'paid'])` to `Set(['completed'])`
- `app/(dashboard)/partners/[id]/page.tsx` (lines 275, 1954): Updated filters to only consider `'completed'` status

---

### 2.2 Per-App/Per-Promo Fixed Amounts (Override Percentage Logic)
**Status**: ✅ **IMPLEMENTED**

**Details**:
- App-specific profit splits implemented via `partner_app_splits` table
- Each partner can have different split percentages per app
- UI allows editing app splits in partner detail page
- `AppSplitsModal` component for managing per-app splits
- Fixed amounts can be set instead of percentages (via `fixed_amount` field)

**Implementation Location**:
- `app/(dashboard)/partners/[id]/page.tsx` (lines 1167-1248)
- `lib/partners.ts` (buildPartnerBreakdown function uses appSplits)
- Database table: `partner_app_splits` with fields: `partner_id`, `app_id`, `partner_percentage`, `owner_percentage`, `fixed_amount`, `notes`

**Note**:
- System supports both percentage-based and fixed-amount splits
- Fixed amounts override percentage calculations when set

---

## 3. APPS

### 3.1 App-Centric View: App → Clients Mapping (3 Columns)
**Status**: ✅ **IMPLEMENTED** (Actually 4 columns)

**Details**:
- App detail page (`/apps/[id]`) shows client categorization
- **4 columns implemented** (not 3 as requested):
  1. **Missing**: Clients who haven't started this app
  2. **To Do**: Clients with `status = 'requested'`
  3. **To Be Finished**: Clients with started apps that are not completed, not paid, not requested, not cancelled, and not error_irrecoverable
  4. **Done**: Clients with `status = 'completed'` or `status = 'paid'`
- Search filter available to filter clients within each column
- Apps with `error_irrecoverable = true` are excluded from all columns
- Each client is clickable and links to their detail page

**Implementation Location**:
- `app/(dashboard)/apps/[id]/page.tsx` (lines 109-173, 258-599)
- Categorization logic in `categorizedClients` useMemo
- Search filtering in `filteredCategorizedClients` useMemo

**Clarification Needed**:
- Request specified 3 columns, but implementation has 4. Should we consolidate "To Be Finished" and "To Do" into one column?

---

### 3.2 Deposit Information When Starting New App
**Status**: ✅ **IMPLEMENTED**

**Details**:
- "Start New App Process" form includes deposit-related fields:
  - **"Paid by (Optional)"**: User who paid (Luna, Marco, Jacopo)
  - **"Paid from"**: Payment source (defaults: "Revolut Marco", "Revolut Jacopo", "Revolut Luna")
  - Custom payment sources can be added and stored in localStorage
  - Deposit amount can be specified
- Fields are optional but available for all new app processes

**Implementation Location**:
- `app/(dashboard)/clients/[id]/page.tsx` (lines 3687-4741)
- Deposit fields in "Start New App Process" form
- Payment source management with localStorage persistence

---

### 3.3 Auto-Create Debt from Deposit Information
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Automatic debt creation when deposit contains user mention or "dep mio"
- Logic checks `is_our_deposit` flag and `deposit_source` field
- Creates entry in `deposit_debts` table automatically
- Works both when:
  - Starting new app process (lines 4709-4741)
  - Updating existing app with deposit info (lines 1281-1324)

**Implementation Location**:
- `app/(dashboard)/clients/[id]/page.tsx` (lines 1281-1324, 4709-4741)
- Auto-creates `deposit_debts` record when conditions are met
- Debt is linked to `client_app_id` and `client_id`

---

### 3.4 Surplus Field
**Status**: ✅ **IMPLEMENTED**

**Details**:
- Surplus field added to `deposit_debts` table
- Example: Sisal deposit 300, withdraw 380 → surplus = 80, total = 380
- Total debt amount = amount + surplus
- Surplus can be entered when creating a new deposit debt
- Debt calculations automatically include surplus in total amount owed

**Implementation**:
- Added `surplus` column to `deposit_debts` table (default 0)
- Updated TypeScript types to include `surplus` field
- Added surplus input field in "New Debt" form for deposit debts
- Updated debt calculation: `totalAmount = amount + surplus`
- Updated remaining amount calculation: `remaining = (amount + surplus) - totalPaid`
- Display shows total amount with breakdown (e.g., "€380.00 (€300.00 + €80.00 surplus)")
- Surplus displayed in debts table, debt detail modal, and client detail page

**Implementation Location**:
- `supabase/migrations/0054_add_surplus_to_deposit_debts.sql`: Database migration
- `types/database.ts`: TypeScript type definitions
- `app/(dashboard)/debts/page.tsx`: UI form and debt calculations
- `app/(dashboard)/clients/[id]/page.tsx`: Client debt display and totals calculation

---

## 4. PIPELINE

### 4.1 Simplified Pipeline: 3 Columns Only
**Status**: ❌ **NOT IMPLEMENTED**

**Details**:
- Current pipeline has 7 columns: `requested`, `registered`, `deposited`, `waiting_bonus`, `completed`, `paid`, `cancelled`
- Request: Replace with only 3 columns:
  1. **TO DO**: All apps that need to be started
  2. **TO BE FINISHED**: Everything not complete, not withdrawn, not unrecoverable error
  3. **DONE**: Completed apps

**Current Implementation**:
- `app/(dashboard)/pipeline/page.tsx` uses `STATUSES` array with 7 statuses
- Drag-and-drop functionality works with current statuses
- Column visibility toggle available

**Required Changes**:
- Redesign pipeline to use 3 custom columns instead of status-based columns
- Map existing statuses to new columns:
  - TO DO: `requested`
  - TO BE FINISHED: `registered`, `deposited`, `waiting_bonus` (excluding `error_irrecoverable = true`)
  - DONE: `completed`, `paid`
- Update drag-and-drop logic to work with new column structure
- May need to preserve status field but display in simplified columns

**Dependencies**:
- Major UI refactoring of pipeline page
- Status mapping logic
- Drag-and-drop handler updates

---

### 4.2 Irrecoverable Error Checkbox
**Status**: ✅ **IMPLEMENTED**

**Details**:
- `error_irrecoverable` field added to `client_apps` table
- Checkbox available in app edit form within client detail page
- When checked, app is hidden from main client view
- Apps with `error_irrecoverable = true` are excluded from:
  - Main "Apps Started" section
  - App-centric view columns
  - Pipeline "TO BE FINISHED" column (when implemented)
- Separate "Hidden Apps" section shows apps with `error_irrecoverable = true`
- Can be unchecked to restore app visibility

**Implementation Location**:
- `app/(dashboard)/clients/[id]/page.tsx` (lines 114, 1185, 1246, 5057-5058, 5904-5905, 6566-6743)
- `app/(dashboard)/apps/[id]/page.tsx` (lines 116-122, 163) - excludes from categorization
- `supabase/migrations/0051_add_error_irrecoverable_to_client_apps.sql`

---

## 5. PAYMENTS

### 5.1 Payment System Status
**Status**: ✅ **USER CONFIRMED AS PERFECT**

**Details**:
- User explicitly stated: "User says this part is already perfect"
- No changes requested for payment system
- Current implementation meets requirements

---

## 6. DEBTS

### 6.1 Filter by User
**Status**: ✅ **IMPLEMENTED**

**Details**:
- User filter dropdown in debts page
- Options: "All", "Luna", "Marco", "Jacopo"
- Filters debts based on `assigned_to` field (for deposit debts) or `deposit_source`
- Filter state: `userFilter` (line 82 in `app/(dashboard)/debts/page.tsx`)

**Implementation Location**:
- `app/(dashboard)/debts/page.tsx` (lines 19, 82, 261-275)
- Filter applied in `filteredRows` useMemo

---

### 6.2 Partial Payments/Receipts
**Status**: ✅ **IMPLEMENTED**

**Details**:
- `debt_payments` table tracks partial payments
- "Add Partial Payment" modal allows entering:
  - Amount (can be positive or negative)
  - Notes
  - "Paid To" field (who received the payment)
  - Date
- Partial payments increase or decrease debt amount
- Total paid calculated as sum of all `debt_payments` for a debt
- Remaining amount = original amount - total paid

**Implementation Location**:
- `app/(dashboard)/debts/page.tsx` (lines 91-94, 119-125, 146-215)
- `debt_payments` table with fields: `debt_id`, `debt_type`, `amount`, `paid_to`, `notes`, `paid_at`
- Partial payment modal: `AddPartialPaymentModal` component

---

### 6.3 Payments to Receive from Link Owners
**Status**: ✅ **IMPLEMENTED**

**Details**:
- "Payments to Receive" section in debts page
- Shows referral links with `owner_client_id` set
- Calculates expected payments based on referral link usage and promotion rewards
- Displays:
  - Referral link code/URL
  - App name
  - Owner client name
  - Expected amount
  - Number of uses

**Implementation Location**:
- `app/(dashboard)/debts/page.tsx` (lines 63-70, 217-240, 667-720)
- Fetches `referral_links` with `owner_client_id`
- Calculates `paymentsToReceive` in useMemo

---

### 6.4 Auto + Manual Debt Creation
**Status**: ✅ **IMPLEMENTED**

**Details**:
- **Automatic debt creation**:
  - When starting app with deposit info containing user name or "dep mio"
  - When updating app with `is_our_deposit = true` and deposit source
  - Creates `deposit_debts` record automatically
- **Manual debt creation**:
  - "New Debt" button in debts page
  - Modal allows creating:
    - Referral link debt
    - Deposit debt
  - Fields: client, app, amount, description, assigned to, etc.

**Implementation Location**:
- Automatic: `app/(dashboard)/clients/[id]/page.tsx` (lines 1281-1324, 4709-4741)
- Manual: `app/(dashboard)/debts/page.tsx` (lines 95-97, 108-117, 430-600)
- `NewDebtModal` component for manual creation

---

## CHECKLIST SUMMARY

### ✅ IMPLEMENTED FEATURES

1. **CLIENTS**
   - ✅ Filter by partner name (free-text search)
   - ✅ Sort by creation date
   - ✅ Separate active/inactive started apps with hide/show toggle

2. **PARTNERS**
   - ✅ Per-app/per-promo fixed amounts (app-specific splits)

3. **APPS**
   - ✅ App-centric view with 4 columns (Missing, To Do, To Be Finished, Done)
   - ✅ Deposit information fields in "Start New App Process"
   - ✅ Auto-create debt from deposit information

4. **PIPELINE**
   - ✅ Irrecoverable error checkbox (hides app from client view)

5. **DEBTS**
   - ✅ Filter by user (Luna, Marco, Jacopo)
   - ✅ Partial payments/receipts support
   - ✅ Payments to receive from link owners section
   - ✅ Auto + manual debt creation

---

### ❌ MISSING / INCOMPLETE FEATURES

1. **PARTNERS**
   - ✅ Update partner "due" on "completed" instead of "paid" (IMPLEMENTED)

2. **APPS**
   - ✅ Surplus field for manual input (IMPLEMENTED)

3. **PIPELINE**
   - ❌ Simplified pipeline to 3 columns (TO DO, TO BE FINISHED, DONE)
     - **Priority**: High
     - **Impact**: Major UX change - pipeline is currently "not useful" according to user
     - **Complexity**: High (requires complete pipeline redesign)

---

### 🔗 DEPENDENCIES BETWEEN FEATURES

1. **Pipeline Simplification → Irrecoverable Error**:
   - Pipeline simplification must respect `error_irrecoverable` flag
   - Apps with `error_irrecoverable = true` should be excluded from "TO BE FINISHED" column
   - ✅ Already implemented in app-centric view, needs to be applied to pipeline

2. **Partner Due on Completed → App Status Updates**:
   - Changing partner balance trigger requires understanding current payment flow
   - May affect existing partner payment records
   - Should coordinate with "Mark as Paid" functionality in partner page

3. **Surplus Field → Debt Calculations**:
   - Surplus affects total debt amount
   - Must update debt display and calculations when surplus is added
   - Should integrate with partial payment system

---

### ❓ POTENTIAL AMBIGUITIES TO CLARIFY

1. **App-Centric View Column Count**:
   - **Request**: 3 columns (who has it, who completed it, who must do it)
   - **Implementation**: 4 columns (Missing, To Do, To Be Finished, Done)
   - **Question**: Should "To Do" and "To Be Finished" be merged into one column?

2. **Pipeline Column Mapping**:
   - **Request**: 3 columns (TO DO, TO BE FINISHED, DONE)
   - **Current**: 7 status-based columns
   - **Question**: How should existing statuses map to new columns?
     - Should `cancelled` status be excluded entirely?
     - Should `waiting_bonus` be in "TO BE FINISHED" or "DONE"?
     - What happens to apps with `error_irrecoverable = true`?

3. **Partner Due Calculation Timing**:
   - **Request**: Update on "completed" instead of "paid"
   - **Question**: Should partner payments still be tracked separately?
   - **Question**: What happens to existing partner balance calculations?
   - **Question**: Should there be a migration for historical data?

4. ~~**Surplus Field Location**~~ ✅ **RESOLVED**:
   - **Decision**: Surplus field implemented on `deposit_debts` table
   - **Implementation**: Surplus is added to deposit debts and included in total amount calculation
   - **Partial Payments**: Surplus is included in total debt amount, so partial payments work correctly against the total (amount + surplus)

5. **Debt Auto-Creation Trigger**:
   - **Current**: Auto-creates when deposit contains user name or "dep mio"
   - **Question**: Should there be additional triggers?
   - **Question**: Should auto-creation be configurable per app or user?

---

## IMPLEMENTATION PRIORITY RECOMMENDATIONS

### High Priority
1. **Pipeline Simplification** (User stated: "Current pipeline is not useful")
2. ~~**Partner Due on Completed**~~ ✅ **COMPLETED** (Affects financial calculations)

### Medium Priority
3. ~~**Surplus Field**~~ ✅ **COMPLETED** (Needed for accurate debt tracking)

### Low Priority
4. **Clarify App-Centric View Column Count** (Already functional, minor UX adjustment)

---

## NOTES

- All implemented features have been verified in codebase
- Missing features require database migrations and/or UI changes
- Dependencies should be considered when implementing missing features
- User feedback indicates payment system is satisfactory and requires no changes

---

**Report Generated**: Based on codebase analysis and feature request list
**Last Updated**: Current codebase state
**Status**: Complete analysis with implementation verification

