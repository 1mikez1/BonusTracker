// scripts/reset-and-import-clients-from-csv.ts
//
// Usage (Windows CMD):
//   cd E:\Bonus\BonusTracker\BonusTracker
//   set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//   set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
//   npx tsx scripts/reset-and-import-clients-from-csv.ts
//
// Usage (Linux/Mac):
//   export SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
//   npx tsx scripts/reset-and-import-clients-from-csv.ts
//
// Cosa fa:
// 1. Legge "Data/New - BH/New - BH - CLIENTI.csv".
// 2. Rileva le app e le colonne di stato.
// 3. Pulisce i dati esistenti (ordine FK-safe).
// 4. Popola:
//      - apps
//      - clients
//      - referral_links
//      - client_apps
//
// Scelte importanti:
// - Flag (INIZIATA, COMPLETATA, RICEVUTA, GIVE_UP) → client_apps.status/deposited/finished.
// - INVITO + REFERENTE → referral_links strutturati (+ collegamento via client_apps.referral_link_id).
// - clients.invited_by_name / needs_rewrite / rewrite_j / goated sono colonne dedicate.
// - clients.notes = SOLO la colonna "Note" del CSV (senza [Flags]...).
//

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

type AppStatusLabel =
  | "GIVE_UP"
  | "INIZIATA"
  | "COMPLETATA"
  | "RICEVUTA"
  | "INVITO"
  | "REFERENTE";

type AppColumnMeta = {
  colIdx: number;
  label: AppStatusLabel;
};

type AppMeta = {
  appCode: string; // e.g. "REVOLUT", "BYBIT"
  columns: AppColumnMeta[];
};

function parseBool(raw: any): boolean {
  const v = (raw ?? "").toString().trim().toUpperCase();
  if (!v) return false;
  if (["FALSE", "NO", "N", "0", "NONE"].includes(v)) return false;
  return true;
}

function normalizeStatusLabel(raw: any): AppStatusLabel | null {
  if (!raw) return null;
  const v = raw.toString().trim().toUpperCase();

  if (v === "INIZIATA") return "INIZIATA";
  if (v === "COMPLETATA") return "COMPLETATA";
  if (v === "RICEVUTA") return "RICEVUTA";
  if (v === "INVITO") return "INVITO";
  if (v === "REFERENTE") return "REFERENTE";
  if (v === "GIVE UP" || v === "GIVEUP" || v === "GIVE  UP" || v === "GIVE_UP")
    return "GIVE_UP";

  return null;
}

/**
 * Split full name into name + surname.
 */
function splitName(full: string | null): { name: string | null; surname: string | null } {
  if (!full) return { name: null, surname: null };
  const trimmed = full.trim();

  if (trimmed.includes("|")) {
    const parts = trimmed
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) return { name: null, surname: null };
    if (parts.length === 1) return { name: parts[0], surname: null };

    const name = parts[0];
    const surname = parts.slice(1).join(" ");
    return { name, surname };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { name: parts[0], surname: null };
  const name = parts[0];
  const surname = parts.slice(1).join(" ");
  return { name, surname };
}

/**
 * Infer client_apps.status + deposited + finished from flags.
 */
function deriveStatusFromFlags(opts: {
  started: boolean;
  completed: boolean;
  bonusReceived: boolean;
  gaveUp: boolean;
}): { status: string; deposited: boolean; finished: boolean } {
  const { started, completed, bonusReceived, gaveUp } = opts;

  if (gaveUp) {
    return {
      status: "cancelled",
      deposited: started || completed || bonusReceived,
      finished: false,
    };
  }

  if (bonusReceived) {
    return { status: "paid", deposited: true, finished: true };
  }

  if (completed) {
    return { status: "completed", deposited: true, finished: true };
  }

  if (started) {
    return { status: "registered", deposited: false, finished: false };
  }

  return { status: "requested", deposited: false, finished: false };
}

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

  // 1) READ CSV
  const csvPath = path.resolve(
    process.cwd(),
    "Data",
    "New - BH",
    "New - BH - CLIENTI.csv"
  );

  console.log("📄 Reading CSV from:", csvPath);
  const rawCsv = fs.readFileSync(csvPath, "utf8");
  const rows: string[][] = parse(rawCsv, {
    skip_empty_lines: false,
  });

  if (rows.length < 3) {
    throw new Error(
      "CSV seems too short, expected at least header + status + data rows."
    );
  }

  const header = rows[0];
  const statusRow = rows[1];
  const dataRows = rows.slice(2);

  console.log(
    `Loaded CSV: ${rows.length} rows, ${header.length} columns. Data rows: ${dataRows.length}`
  );

  // 2) DETECT APPS FROM HEADER + STATUS ROW
  const appMetas: AppMeta[] = [];
  let currentApp: AppMeta | null = null;

  const CLIENT_COLUMNS_END = 10; // primi 10 = dati cliente

  for (let colIdx = CLIENT_COLUMNS_END; colIdx < header.length; colIdx++) {
    const colName = (header[colIdx] ?? "").toString().trim();
    const label = normalizeStatusLabel(statusRow[colIdx]);

    if (colName) {
      currentApp = { appCode: colName, columns: [] };
      appMetas.push(currentApp);
    }

    if (!currentApp) continue;
    if (!label) continue;

    currentApp.columns.push({ colIdx, label });
  }

  console.log("Detected apps from CSV:");
  for (const app of appMetas) {
    console.log(
      `- ${app.appCode}: columns -> ${app.columns
        .map((c) => `${c.colIdx}:${c.label}`)
        .join(", ")}`
    );
  }

  // 3) CLIENT COLUMN INDEXES
  const idxNome = header.indexOf("Nome");
  const idxCognome = header.indexOf("Cognome");
  const idxNomeCognome = header.indexOf("Nome|Cognome");
  const idxNomeReferente = header.indexOf("Nome referente");
  const idxTrusted = header.indexOf("TRUSTED");
  const idxRiscrivere = header.indexOf("RISCRIVERE");
  const idxRiscriveJ = header.indexOf("Riscrive J");
  const idxGoated = header.indexOf("GOATED");
  const idxNote = header.indexOf("Note"); // 🔥 NOTE VERE del cliente

  if (idxNome === -1 || idxCognome === -1 || idxNomeCognome === -1) {
    throw new Error(
      "Could not find Nome / Cognome / Nome|Cognome columns in CSV header. Check header names."
    );
  }

  // 4) ARRAYS IN-MEMORY
  const appsToInsert: {
    id: string;
    name: string;
    is_active: boolean;
    notes: string | null;
  }[] = [];
  const appCodeToId = new Map<string, string>();

  for (const appMeta of appMetas) {
    const appId = randomUUID();
    appCodeToId.set(appMeta.appCode, appId);
    appsToInsert.push({
      id: appId,
      name: appMeta.appCode,
      is_active: true,
      notes: null,
    });
  }

  const clientsToInsert: {
    id: string;
    name: string | null;
    surname: string | null;
    contact: string | null;
    email: string | null;
    trusted: boolean;
    tier_id: string | null;
    invited_by_client_id: string | null;
    invited_by_name: string | null;
    needs_rewrite: boolean;
    rewrite_j: boolean;
    goated: boolean;
    notes: string | null;
  }[] = [];

  const referralLinksToInsert: {
    id: string;
    app_id: string;
    url: string; // NOT NULL
    owner_client_id: string | null;
    max_uses: number | null;
    current_uses: number;
    is_active: boolean;
    notes: string | null;
  }[] = [];

  const referralKeyToId = new Map<string, string>();

  const clientAppsToInsert: {
    id: string;
    client_id: string;
    app_id: string;
    status: string;
    deposited: boolean;
    finished: boolean;
    deposit_amount: number | null;
    profit_client: number | null;
    profit_us: number | null;
    notes: string | null;
    referral_link_id: string | null;
  }[] = [];

  for (const row of dataRows) {
    const nome = row[idxNome] ? row[idxNome].toString().trim() : "";
    const cognome = row[idxCognome] ? row[idxCognome].toString().trim() : "";

    const fullFromField =
      row[idxNomeCognome] && row[idxNomeCognome].toString().trim().length > 0
        ? row[idxNomeCognome].toString().trim()
        : [nome, cognome].filter(Boolean).join(" ");

    if (!nome && !cognome && !fullFromField) {
      continue;
    }

    // Cognome = telefono? → spostalo in contact
    let contact: string | null = null;
    if (cognome) {
      const phoneCandidate = cognome.replace(/[()\s\-]/g, "");
      const isPhone =
        phoneCandidate.length >= 6 && /^[0-9+]+$/.test(phoneCandidate);
      if (isPhone) {
        contact = cognome;
      }
    }

    const { name, surname } = splitName(fullFromField || null);

    const invitedByName =
      idxNomeReferente >= 0 && row[idxNomeReferente]
        ? row[idxNomeReferente].toString().trim()
        : null;

    const trusted = idxTrusted >= 0 ? parseBool(row[idxTrusted]) : false;
    const needsRewrite =
      idxRiscrivere >= 0 ? parseBool(row[idxRiscrivere]) : false;
    const rewriteJ = idxRiscriveJ >= 0 ? parseBool(row[idxRiscriveJ]) : false;
    const goated = idxGoated >= 0 ? parseBool(row[idxGoated]) : false;

    // NOTE del cliente: SOLO colonna "Note" del CSV
    const rawNote =
      idxNote >= 0 && row[idxNote]
        ? row[idxNote].toString().trim()
        : "";
    const notes = rawNote.length > 0 ? rawNote : null;

    const clientId = randomUUID();

    clientsToInsert.push({
      id: clientId,
      name,
      surname,
      contact,
      email: null,
      trusted,
      tier_id: null,
      invited_by_client_id: null,
      invited_by_name: invitedByName,
      needs_rewrite: needsRewrite,
      rewrite_j: rewriteJ,
      goated,
      notes,
    });

    // Per ogni APP → client_apps + referral_links
    for (const appMeta of appMetas) {
      const appId = appCodeToId.get(appMeta.appCode);
      if (!appId) continue;

      let started = false;
      let completedApp = false;
      let bonusReceived = false;
      let gaveUp = false;
      let inviteRaw: string | null = null;
      let referrerNameRaw: string | null = null;

      for (const col of appMeta.columns) {
        const rawValue = row[col.colIdx];

        switch (col.label) {
          case "INIZIATA":
            if (parseBool(rawValue)) started = true;
            break;
          case "COMPLETATA":
            if (parseBool(rawValue)) completedApp = true;
            break;
          case "RICEVUTA":
            if (parseBool(rawValue)) bonusReceived = true;
            break;
          case "GIVE_UP":
            if (parseBool(rawValue)) gaveUp = true;
            break;
          case "INVITO":
            if (rawValue && rawValue.toString().trim()) {
              inviteRaw = rawValue.toString().trim();
            }
            break;
          case "REFERENTE":
            if (rawValue && rawValue.toString().trim()) {
              referrerNameRaw = rawValue.toString().trim();
            }
            break;
        }
      }

      const hasAnyData =
        started ||
        completedApp ||
        bonusReceived ||
        gaveUp ||
        (inviteRaw && inviteRaw.trim() !== "") ||
        (referrerNameRaw && referrerNameRaw.trim() !== "");

      if (!hasAnyData) continue;

      const statusInfo = deriveStatusFromFlags({
        started,
        completed: completedApp,
        bonusReceived,
        gaveUp,
      });

      let referralLinkId: string | null = null;
      if (inviteRaw || referrerNameRaw) {
        const key = `${appMeta.appCode}|${inviteRaw ?? ""}|${
          referrerNameRaw ?? ""
        }`;

        if (referralKeyToId.has(key)) {
          referralLinkId = referralKeyToId.get(key)!;
        } else {
          const newReferralId = randomUUID();
          referralKeyToId.set(key, newReferralId);

          const urlValue =
            (inviteRaw && inviteRaw.trim()) ||
            (referrerNameRaw && referrerNameRaw.trim()) ||
            "MISSING_URL";

          referralLinksToInsert.push({
            id: newReferralId,
            app_id: appId,
            url: urlValue,
            owner_client_id: null,
            max_uses: null,
            current_uses: 0,
            is_active: true,
            notes: referrerNameRaw ? `REFERENTE: ${referrerNameRaw}` : null,
          });

          referralLinkId = newReferralId;
        }
      }

      const appNotes: string | null = null;

      clientAppsToInsert.push({
        id: randomUUID(),
        client_id: clientId,
        app_id: appId,
        status: statusInfo.status,
        deposited: statusInfo.deposited,
        finished: statusInfo.finished,
        deposit_amount: null,
        profit_client: null,
        profit_us: null,
        notes: appNotes,
        referral_link_id: referralLinkId,
      });
    }
  }

  console.log(`Prepared ${appsToInsert.length} apps.`);
  console.log(`Prepared ${clientsToInsert.length} clients.`);
  console.log(`Prepared ${referralLinksToInsert.length} referral_links rows.`);
  console.log(`Prepared ${clientAppsToInsert.length} client_apps rows.`);

  // 5) WIPE EXISTING DATA
  async function wipeTable(table: string) {
    console.log(`Wiping table ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .not("id", "is", null);
    if (error && error.code !== "42P01") {
      console.error(`Error wiping ${table}:`, error);
      throw error;
    }
  }

  console.log("🧹 Wiping existing data (children → parents)...");

  try {
    console.log("Clearing client foreign keys (tier_id, invited_by_client_id)...");
    const { error: fkError } = await supabase
      .from("clients")
      .update({
        tier_id: null,
        invited_by_client_id: null,
      })
      .not("id", "is", null);

    if (fkError && fkError.code !== "42P01") {
      throw fkError;
    }
  } catch (e) {
    console.warn(
      "Warning while clearing client FKs (can ignore if table is empty/new):",
      e
    );
  }

  const wipeOrder = [
    "client_apps",
    "requests",
    "referral_link_debts",
    "referral_links",
    "payment_links",
    "credentials",
    "slots",
    "message_templates",
    "promotions",
    "clients",
    "tiers",
    "apps",
  ];

  for (const table of wipeOrder) {
    await wipeTable(table);
  }

  console.log("✅ Existing data wiped.");

  // 6) INSERT NEW DATA
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

  await insertBatch("apps", appsToInsert);
  await insertBatch("clients", clientsToInsert);
  await insertBatch("referral_links", referralLinksToInsert);
  await insertBatch("client_apps", clientAppsToInsert);

  console.log("✅ Import completed successfully.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
