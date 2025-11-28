// scripts/import-promotions-from-csv.ts
//
// Usage (Windows CMD):
//   cd E:\Bonus\BonusTracker\BonusTracker
//   set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//   set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
//   npx tsx scripts/import-promotions-from-csv.ts
//
// Cosa fa:
// 1. Legge "Data/New - BH/New - BH - Promozioni.csv".
// 2. Per ogni riga crea/usa un'app (tabella apps).
// 3. Cancella tutte le promozioni esistenti.
// 4. Inserisce nuove righe nella tabella promotions,
//    mappando le colonne italiane sullo schema del DB.

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Helpers -----------------------------

function normalizeHeader(value: string | undefined | null): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findColumnIndex(header: string[], label: string): number {
  const target = normalizeHeader(label);
  return header.findIndex((h) => normalizeHeader(h) === target);
}

function parseItalianNumber(raw: any): number | null {
  if (raw == null) return null;
  let s = raw.toString().trim();
  if (!s) return null;

  // Remove euro signs and other symbols
  s = s.replace(/[€\s]/g, "");

  // Handle thousand separators and decimal comma
  // e.g. "1.234,56" -> "1234.56"
  s = s.replace(/\./g, "").replace(/,/g, ".");

  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n;
}

function parseInteger(raw: any): number | null {
  const n = parseItalianNumber(raw);
  if (n == null) return null;
  const intVal = Math.round(n);
  if (Number.isNaN(intVal)) return null;
  return intVal;
}

function parseItalianDate(raw: any): string | null {
  if (!raw) return null;
  let s = raw.toString().trim();
  if (!s) return null;

  // If it's something like "31/12/2024" or "31-12-2024"
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [_, dd, mm, yyyy] = m;
    if (yyyy.length === 2) {
      const yearNum = parseInt(yyyy, 10);
      yyyy = yearNum >= 50 ? `19${yyyy}` : `20${yyyy}`;
    }
    const day = dd.padStart(2, "0");
    const month = mm.padStart(2, "0");
    return `${yyyy}-${month}-${day}`; // YYYY-MM-DD
  }

  // Try direct Date parsing as fallback
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseBoolFromGeneric(raw: any): boolean {
  const v = (raw ?? "").toString().trim().toLowerCase();
  if (!v) return false;
  if (["no", "0", "false", "n", "off"].includes(v)) return false;
  return true;
}

// ------------------------------------

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them before running this script."
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Leggo il CSV Promozioni
  const csvPath = path.resolve(
    process.cwd(),
    "Data",
    "New - BH",
    "New - BH - Promozioni.csv"
  );

  console.log("📄 Reading promotions CSV from:", csvPath);
  const rawCsv = fs.readFileSync(csvPath, "utf8");
  const rows: string[][] = parse(rawCsv, {
    skip_empty_lines: false,
  });

  if (rows.length < 2) {
    throw new Error(
      "Promozioni CSV troppo corto: atteso almeno header + 1 riga di dati."
    );
  }

  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log(
    `Loaded Promotions CSV: ${rows.length} rows, ${header.length} columns. Data rows: ${dataRows.length}`
  );

  // 2) Mappo gli indici colonna in base ai titoli

  // Prima colonna: app + nome promo (es. "REVOLUT - 10€ bonus")
  const idxFirstCol = 0;

  const idxProfittoCliente = findColumnIndex(header, "Profitto cliente");
  const idxRicavoNostro = findColumnIndex(header, "Ricavo nostro");
  const idxProfittoMZ = findColumnIndex(header, "Profitto MZ");
  const idxProfittoNostro2 = findColumnIndex(header, "Profitto nostro");
  const idxTipoProfit = findColumnIndex(header, "Tipo Profit");
  const idxDeposito = findColumnIndex(header, "Deposito");
  const idxSpesa = findColumnIndex(header, "Spesa");
  const idxNumeroInviti = findColumnIndex(header, "Numero inviti");
  const idxScadenza = findColumnIndex(header, "Scadenza");
  const idxTempistiche = findColumnIndex(header, "Tempistiche ricezione");
  const idxDocAcc = findColumnIndex(header, "Documenti accettati");
  const idxTC = findColumnIndex(header, "T&C");
  const idxNote = findColumnIndex(header, "Note");
  const idxAttiva = findColumnIndex(header, "ATTIVA");

  const requiredCols = [
    { idx: idxProfittoCliente, name: "Profitto cliente" },
    { idx: idxRicavoNostro, name: "Ricavo nostro" },
    { idx: idxTipoProfit, name: "Tipo Profit" },
    { idx: idxDeposito, name: "Deposito" },
    { idx: idxSpesa, name: "Spesa" },
    { idx: idxNumeroInviti, name: "Numero inviti" },
    { idx: idxScadenza, name: "Scadenza" },
    { idx: idxTempistiche, name: "Tempistiche ricezione" },
    { idx: idxTC, name: "T&C" },
    { idx: idxAttiva, name: "ATTIVA" },
  ];

  for (const col of requiredCols) {
    if (col.idx === -1) {
      console.warn(
        `⚠️ Column "${col.name}" not found in header. (Non-blocking, but check header names)`
      );
    }
  }

  // 3) Carico apps esistenti dal DB (per app_id)
  console.log("🔍 Loading existing apps from DB...");
  const { data: existingApps, error: appsError } = await supabase
    .from("apps")
    .select("id, name");

  if (appsError) {
    throw appsError;
  }

  const appNameToId = new Map<string, string>();
  (existingApps ?? []).forEach((a) => {
    appNameToId.set(a.name, a.id);
  });

  console.log(
    `Found ${existingApps?.length ?? 0} existing apps in database.`
  );

  // 4) Preparo liste da inserire
  const newAppsToInsert: { id: string; name: string; is_active: boolean; notes: string | null }[] =
    [];
  const promotionsToInsert: {
    id: string;
    app_id: string;
    name: string;
    client_reward: number;
    our_reward: number;
    deposit_required: number; // NOT NULL in DB, default 0
    expense: number | null;
    max_invites: number | null;
    profit_type: string | null;
    time_to_get_bonus: string | null;
    start_date: string | null;
    end_date: string | null;
    terms_conditions: string | null;
    notes: string | null;
    is_active: boolean;
  }[] = [];

  // Funzione per ottenere (o creare) app_id dato appCode
  function getOrCreateAppId(appCode: string): string {
    const code = appCode.trim();
    if (!code) {
      throw new Error("Empty appCode in promotions CSV first column.");
    }

    if (appNameToId.has(code)) {
      return appNameToId.get(code)!;
    }

    const newId = randomUUID();
    appNameToId.set(code, newId);
    newAppsToInsert.push({
      id: newId,
      name: code,
      is_active: true,
      notes: null,
    });
    return newId;
  }

  // 5) Parse di ogni riga del CSV
  for (const row of dataRows) {
    // Se la riga è completamente vuota, salta
    if (!row || row.every((cell) => !cell || !cell.toString().trim())) {
      continue;
    }

    const firstColRaw = (row[idxFirstCol] ?? "").toString().trim();
    if (!firstColRaw) {
      // niente app/promo → skip
      continue;
    }

    // Estraggo appCode e promoName da "APP - Nome promo"
    let appCode = firstColRaw;
    let promoName = firstColRaw;

    const dashIdx = firstColRaw.indexOf(" - ");
    if (dashIdx > 0) {
      appCode = firstColRaw.slice(0, dashIdx).trim();
      promoName = firstColRaw.slice(dashIdx + 3).trim() || appCode;
    }

    const app_id = getOrCreateAppId(appCode);

    // Campi numerici
    const clientReward = parseItalianNumber(
      idxProfittoCliente >= 0 ? row[idxProfittoCliente] : null
    );
    const ourReward = parseItalianNumber(
      idxRicavoNostro >= 0 ? row[idxRicavoNostro] : null
    );

    // Profitto MZ / Profitto nostro extra → li mettiamo in note
    const profittoMZ =
      idxProfittoMZ >= 0 && row[idxProfittoMZ]
        ? row[idxProfittoMZ].toString().trim()
        : "";
    const profittoNostro2 =
      idxProfittoNostro2 >= 0 && row[idxProfittoNostro2]
        ? row[idxProfittoNostro2].toString().trim()
        : "";

    const depositRequired = parseItalianNumber(
      idxDeposito >= 0 ? row[idxDeposito] : null
    );
    const expense = parseItalianNumber(
      idxSpesa >= 0 ? row[idxSpesa] : null
    );
    const maxInvites = parseInteger(
      idxNumeroInviti >= 0 ? row[idxNumeroInviti] : null
    );

    // Date
    const endDate = parseItalianDate(
      idxScadenza >= 0 ? row[idxScadenza] : null
    );
    const startDate: string | null = null; // non presente nel CSV, per ora null

    // Testo
    const profitType =
      idxTipoProfit >= 0 && row[idxTipoProfit]
        ? row[idxTipoProfit].toString().trim()
        : null;

    const tempoRicezione =
      idxTempistiche >= 0 && row[idxTempistiche]
        ? row[idxTempistiche].toString().trim()
        : "";
    const docAcc =
      idxDocAcc >= 0 && row[idxDocAcc]
        ? row[idxDocAcc].toString().trim()
        : "";
    const tAndC =
      idxTC >= 0 && row[idxTC] ? row[idxTC].toString().trim() : "";
    const noteExtra =
      idxNote >= 0 && row[idxNote] ? row[idxNote].toString().trim() : "";

    const isActive =
      idxAttiva >= 0 ? parseBoolFromGeneric(row[idxAttiva]) : true;

    // Costruzione campo notes
    const notesParts: string[] = [];

    if (profittoMZ) notesParts.push(`Profitto MZ: ${profittoMZ}`);
    if (profittoNostro2) notesParts.push(`Profitto nostro (extra): ${profittoNostro2}`);
    if (tempoRicezione) notesParts.push(`Tempistiche ricezione: ${tempoRicezione}`);
    if (docAcc) notesParts.push(`Documenti accettati: ${docAcc}`);
    if (noteExtra) notesParts.push(noteExtra);

    const notes = notesParts.length > 0 ? notesParts.join(" | ") : null;

    // Valori finali per INSERT
    promotionsToInsert.push({
      id: randomUUID(),
      app_id,
      name: promoName,
      client_reward: clientReward ?? 0,
      our_reward: ourReward ?? 0,
      deposit_required: depositRequired ?? 0, // NOT NULL constraint, default to 0 if null
      expense,
      max_invites: maxInvites,
      profit_type: profitType,
      time_to_get_bonus: tempoRicezione || null,
      start_date: startDate,
      end_date: endDate,
      terms_conditions: tAndC || null,
      notes,
      is_active: isActive,
    });
  }

  console.log(`Prepared ${newAppsToInsert.length} new apps to insert (if any).`);
  console.log(`Prepared ${promotionsToInsert.length} promotions to insert.`);

  // 6) Inserisco nuove apps (se serve)
  async function insertBatch(table: string, rows: any[], batchSize = 200) {
    if (rows.length === 0) return;
    console.log(`Inserting into ${table}: ${rows.length} rows...`);
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { error } = await supabase.from(table).insert(chunk);
      if (error) {
        console.error(
          `Error inserting into ${table} (batch starting at ${i}):`,
          error
        );
        throw error;
      }
    }
  }

  if (newAppsToInsert.length > 0) {
    console.log("🧩 Inserting new apps created from promotions CSV...");
    await insertBatch("apps", newAppsToInsert);
  }

  // 7) Wipe promozioni esistenti e inserisci le nuove
  console.log("🧹 Wiping existing promotions...");
  const { error: wipePromosError } = await supabase
    .from("promotions")
    .delete()
    .not("id", "is", null);

  if (wipePromosError && wipePromosError.code !== "42P01") {
    console.error("Error wiping promotions:", wipePromosError);
    throw wipePromosError;
  }

  console.log("✅ Existing promotions wiped. Inserting new promotions...");
  await insertBatch("promotions", promotionsToInsert);

  console.log("✅ Promotions import completed successfully.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
