# CSV Column Mapping Reference

This guide helps you map your Excel CSV columns to the migration script.

## Table: CLIENTI (Clients)

### Expected Database Columns
- `name` (required)
- `surname`
- `contact`
- `email`
- `trusted` (boolean)
- `tier_id` (UUID - reference to tiers table)
- `invited_by_client_id` (UUID - reference to clients table)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `Nome` | `row['Nome']` |
| `Name` | `row['Name']` |
| `Client Name` | `row['Client Name']` |
| `Cognome` | `row['Cognome']` |
| `Surname` | `row['Surname']` |
| `Telegram` | `row['Telegram']` |
| `WhatsApp` | `row['WhatsApp']` |
| `Contact` | `row['Contact']` |
| `Email` | `row['Email']` |
| `Trusted` | `row['Trusted'] === 'TRUE'` |
| `Tier` | `row['Tier']` (needs lookup to tiers table) |
| `Invited By` | `row['Invited By']` (needs lookup to clients table) |
| `Notes` | `row['Notes']` |

### Example Mapping

```typescript
const clientData = {
  name: row['Nome'] || row['Name'] || '',
  surname: row['Cognome'] || row['Surname'] || null,
  contact: row['Telegram'] || row['WhatsApp'] || row['Contact'] || null,
  email: row['Email'] || null,
  trusted: row['Trusted'] === 'TRUE' || row['Trusted'] === '1' || row['Trusted'] === 'Sì',
  tier_id: tierMap.get(row['Tier'] || '') || null,
  invited_by_client_id: null, // Resolve in second pass
  notes: row['Note'] || row['Notes'] || null
};
```

---

## Table: INVITI (Referral Links)

### Expected Database Columns
- `app_id` (UUID - reference to apps table)
- `url` (required)
- `owner_client_id` (UUID - reference to clients table, nullable)
- `max_uses` (integer, nullable)
- `current_uses` (integer, default 0)
- `is_active` (boolean)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `App` | `row['App']` |
| `App Name` | `row['App Name']` |
| `URL` | `row['URL']` |
| `Referral URL` | `row['Referral URL']` |
| `Code` | `row['Code']` |
| `Owner` | `row['Owner']` (needs lookup) |
| `Max Uses` | `parseInt(row['Max Uses'])` |
| `Uses` | `parseInt(row['Uses'])` |
| `Current Uses` | `parseInt(row['Current Uses'])` |
| `Active` | `row['Active'] !== 'FALSE'` |

---

## Table: PROMOZIONI (Promotions)

### Expected Database Columns
- `app_id` (UUID)
- `name` (required)
- `client_reward` (numeric)
- `our_reward` (numeric)
- `deposit_required` (numeric)
- `freeze_days` (integer, nullable)
- `time_to_get_bonus` (text)
- `start_date` (date, nullable)
- `end_date` (date, nullable)
- `terms_conditions` (text)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `App` | `row['App']` |
| `Promotion Name` | `row['Promotion Name']` |
| `Client Reward` | `parseFloat(row['Client Reward'])` |
| `Our Reward` | `parseFloat(row['Our Reward'])` |
| `Deposit Required` | `parseFloat(row['Deposit Required'])` |
| `Freeze Days` | `parseInt(row['Freeze Days'])` |
| `Time to Get Bonus` | `row['Time to Get Bonus']` |
| `End Date` | `new Date(row['End Date']).toISOString()` |
| `Terms` | `row['Terms']` |

---

## Table: Client-Apps (Per-App Sheets)

### Expected Database Columns
- `client_id` (UUID)
- `app_id` (UUID)
- `status` (enum: requested, registered, deposited, etc.)
- `deposited` (boolean)
- `finished` (boolean)
- `deposit_amount` (numeric, nullable)
- `profit_client` (numeric, nullable)
- `profit_us` (numeric, nullable)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `Client` | `row['Client']` |
| `Client Name` | `row['Client Name']` |
| `Deposited` | `row['Deposited'] === 'TRUE'` |
| `Finished` | `row['Finished'] === 'TRUE'` |
| `Deposit Amount` | `parseFloat(row['Deposit Amount'])` |
| `Profit Client` | `parseFloat(row['Profit Client'])` |
| `Profit Us` | `parseFloat(row['Profit Us'])` |

---

## Table: MAIL (Credentials)

### Expected Database Columns
- `client_id` (UUID)
- `app_id` (UUID)
- `email` (required)
- `username` (nullable)
- `password_encrypted` (required - must be encrypted!)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `Client` | `row['Client']` |
| `App` | `row['App']` |
| `Email` | `row['Email']` |
| `Username` | `row['Username']` |
| `Password` | `encryptPassword(row['Password'])` ⚠️ |

### ⚠️ Important: Password Encryption

**DO NOT** store passwords in plain text. Use encryption:

```typescript
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-key-here';

function encryptPassword(password: string): string {
  // Simple base64 (not secure, but works for MVP)
  return Buffer.from(password).toString('base64');
  
  // OR proper encryption:
  // const iv = crypto.randomBytes(16);
  // const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  // let encrypted = cipher.update(password, 'utf8', 'hex');
  // encrypted += cipher.final('hex');
  // return iv.toString('hex') + ':' + encrypted;
}
```

---

## Table: DEBTS (Referral Link Debts)

### Expected Database Columns
- `referral_link_id` (UUID)
- `creditor_client_id` (UUID)
- `debtor_client_id` (UUID, nullable)
- `amount` (numeric, required)
- `status` (enum: open, partial, settled)
- `description` (text)
- `created_at` (timestamp)
- `settled_at` (timestamp, nullable)

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `App` | `row['App']` |
| `Link Owner` | `row['Link Owner']` |
| `Creditor` | `row['Creditor']` |
| `Borrower` | `row['Borrower']` |
| `Debtor` | `row['Debtor']` |
| `Amount` | `parseFloat(row['Amount'])` |
| `Status` | `row['Status']` (must be: open, partial, or settled) |

---

## Table: GuideMessages (Message Templates)

### Expected Database Columns
- `name` (required)
- `app_id` (UUID, nullable - null for generic messages)
- `step` (text)
- `language` (text)
- `content` (required)
- `notes`

### Common CSV Column Names

| Your CSV Column | Script Mapping |
|----------------|----------------|
| `Name` | `row['Name']` |
| `Template Name` | `row['Template Name']` |
| `App` | `row['App']` |
| `Step` | `row['Step']` |
| `Language` | `row['Language']` |
| `Content` | `row['Content']` |
| `Message` | `row['Message']` |

---

## Helper Functions

### Parse Numeric Values

```typescript
function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[€$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
```

### Parse Boolean Values

```typescript
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized === 'TRUE' || 
         normalized === '1' || 
         normalized === 'YES' || 
         normalized === 'SÌ' ||
         normalized === 'SI';
}
```

### Parse Dates

```typescript
function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  try {
    // Handle Excel date format
    const date = new Date(value);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}
```

### Lookup Functions

```typescript
// Create lookup maps after loading data
const appMap = new Map<string, string>(); // name -> id
const clientMap = new Map<string, string>(); // identifier -> id
const tierMap = new Map<string, string>(); // name -> id

// After loading apps
apps.forEach(app => {
  appMap.set(app.name.toUpperCase(), app.id);
});

// After loading clients
clients.forEach(client => {
  const identifier = `${client.name}_${client.contact || ''}`;
  clientMap.set(identifier, client.id);
});
```

---

## Testing Your Mappings

Add this test function to verify your CSV structure:

```typescript
function testCSVMapping(filePath: string) {
  try {
    const rows = readCSV(filePath);
    console.log(`\n📄 Testing: ${filePath}`);
    console.log(`   Rows: ${rows.length}`);
    console.log(`   Headers: ${Object.keys(rows[0] || {}).join(', ')}`);
    console.log(`   First row sample:`, rows[0]);
    
    // Test your mappings
    if (rows.length > 0) {
      const row = rows[0];
      console.log(`\n   Sample mappings:`);
      console.log(`   Name: ${row['Nome'] || row['Name'] || 'NOT FOUND'}`);
      console.log(`   Contact: ${row['Telegram'] || row['Contact'] || 'NOT FOUND'}`);
    }
  } catch (error) {
    console.error(`   ❌ Error reading ${filePath}:`, error);
  }
}

// Run tests
testCSVMapping('data/CLIENTI.csv');
testCSVMapping('data/INVITI.csv');
// ... test other files
```

---

## Common Issues

### Issue: Column names have spaces or special characters

**Solution**: Use bracket notation:
```typescript
row['Client Name']  // ✅ Works
row.Client Name     // ❌ Syntax error
```

### Issue: Numeric values have currency symbols

**Solution**: Clean before parsing:
```typescript
const amount = parseFloat(row['Amount'].replace(/[€$,\s]/g, ''));
```

### Issue: Dates are in wrong format

**Solution**: Parse and convert:
```typescript
const date = new Date(row['Date']);
const isoDate = date.toISOString().split('T')[0];
```

### Issue: Boolean values are inconsistent

**Solution**: Normalize:
```typescript
const isActive = ['TRUE', '1', 'YES', 'SÌ'].includes(
  (row['Active'] || '').toUpperCase()
);
```

---

## Quick Reference Checklist

When updating the migration script:

- [ ] Map all required fields (non-nullable columns)
- [ ] Handle nullable fields (use `|| null`)
- [ ] Parse numeric values (remove currency symbols)
- [ ] Parse boolean values (normalize to true/false)
- [ ] Parse dates (convert to ISO format)
- [ ] Create lookup maps for foreign keys
- [ ] Test with sample CSV file
- [ ] Handle missing columns gracefully
- [ ] Add error handling for invalid data

