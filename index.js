const express = require("express");
const sql = require("mssql");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));

const allowedDonationTypes = new Set(["krev", "plazma"]);
const allowedFatigueRatings = new Set(["1", "2", "3", "4", "5"]);
let poolPromise;

function resolveConnectionConfig() {
  const fromConnectionString =
    process.env.AZURE_SQL_CONNECTIONSTRING || process.env.SQLCONNSTR_248256;

  if (fromConnectionString) {
    return fromConnectionString;
  }

  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || "248256.database.windows.net",
    database: process.env.DB_DATABASE || "248256",
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function ensureDbCredentials(config) {
  if (typeof config === "string") {
    return;
  }

  if (!config.user || !config.password || !config.server || !config.database) {
    throw new Error(
      "Missing Azure SQL configuration. Set AZURE_SQL_CONNECTIONSTRING or DB_USER/DB_PASSWORD/DB_SERVER/DB_DATABASE.",
    );
  }
}

async function getPool() {
  if (!poolPromise) {
    const config = resolveConnectionConfig();
    ensureDbCredentials(config);

    poolPromise = sql
      .connect(config)
      .then(async (pool) => {
        await pool
          .request()
          .query(`
            IF OBJECT_ID('dbo.DonationRecords', 'U') IS NULL
            BEGIN
              CREATE TABLE dbo.DonationRecords (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                DonationDate DATE NOT NULL,
                DonationType NVARCHAR(20) NOT NULL,
                ArrivalTime TIME(0) NULL,
                DepartureTime TIME(0) NULL,
                FatigueRating TINYINT NULL,
                Note NVARCHAR(1000) NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
              );
            END;

            IF COL_LENGTH('dbo.DonationRecords', 'ArrivalTime') IS NULL
              ALTER TABLE dbo.DonationRecords ADD ArrivalTime TIME(0) NULL;

            IF COL_LENGTH('dbo.DonationRecords', 'DepartureTime') IS NULL
              ALTER TABLE dbo.DonationRecords ADD DepartureTime TIME(0) NULL;

            IF COL_LENGTH('dbo.DonationRecords', 'FatigueRating') IS NULL
              ALTER TABLE dbo.DonationRecords ADD FatigueRating TINYINT NULL;

            IF COL_LENGTH('dbo.DonationRecords', 'Note') IS NULL
              ALTER TABLE dbo.DonationRecords ADD Note NVARCHAR(1000) NULL;
          `);

        return pool;
      })
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }

  return poolPromise;
}

function isValidId(value) {
  return /^\d+$/.test(String(value || ""));
}

async function getDonationRecordById(recordId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("Id", sql.Int, Number(recordId))
    .query(`
      SELECT TOP (1)
        Id,
        DonationDate,
        DonationType,
        ArrivalTime,
        DepartureTime,
        FatigueRating,
        Note,
        CreatedAt
      FROM dbo.DonationRecords
      WHERE Id = @Id
    `);

  return result.recordset[0] || null;
}

async function getDonationRecords() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      Id,
      DonationDate,
      DonationType,
      ArrivalTime,
      DepartureTime,
      FatigueRating,
      Note,
      CreatedAt
    FROM dbo.DonationRecords
    ORDER BY DonationDate DESC, CreatedAt DESC, Id DESC
  `);

  return result.recordset;
}

function formatDateForInput(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatTimeForInput(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatDateForDisplay(value) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeForDisplay(value) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage({
  errorMessage = "",
  successMessage = "",
  records = [],
  formValues = {},
  isEditMode = false,
} = {}) {
  const formTitle = isEditMode ? "Upravit záznam" : "Nový záznam";
  const submitLabel = isEditMode ? "Uložit změny" : "Uložit záznam";
  const subtitle =
    "Zadej datum, typ, časy, únavu a poznámku. Záznamy se ukládají do Azure SQL databáze.";

  const donationDateValue = escapeHtml(formValues.donationDate || "");
  const donationTypeValue = formValues.donationType || "";
  const arrivalTimeValue = escapeHtml(formValues.arrivalTime || "");
  const departureTimeValue = escapeHtml(formValues.departureTime || "");
  const fatigueRatingValue = String(formValues.fatigueRating || "");
  const noteValue = escapeHtml(formValues.note || "");

  const typeOptions = [
    { value: "", label: "Vyber typ odběru" },
    { value: "krev", label: "krev" },
    { value: "plazma", label: "plazma" },
  ]
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === donationTypeValue ? "selected" : ""}>${option.label}</option>`,
    )
    .join("");

  const fatigueOptions = [
    { value: "", label: "Vyber hodnocení" },
    { value: "1", label: "1 - velmi unavený" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5 - cítil jsem se nejlépe" },
  ]
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === fatigueRatingValue ? "selected" : ""}>${option.label}</option>`,
    )
    .join("");

  const recordsMarkup = records.length
    ? records
        .map((record) => {
          const noteText = record.Note ? escapeHtml(record.Note) : "—";
          return `<tr>
            <td>${escapeHtml(record.Id)}</td>
            <td>${escapeHtml(formatDateForDisplay(record.DonationDate))}</td>
            <td>${escapeHtml(record.DonationType)}</td>
            <td>${escapeHtml(formatTimeForInput(record.ArrivalTime) || "—")}</td>
            <td>${escapeHtml(formatTimeForInput(record.DepartureTime) || "—")}</td>
            <td>${escapeHtml(record.FatigueRating ?? "—")}</td>
            <td class="note-cell">${noteText}</td>
            <td>${escapeHtml(formatDateTimeForDisplay(record.CreatedAt))}</td>
            <td class="actions">
              <a class="action-link" href="/?edit=${record.Id}">Upravit</a>
              <form method="post" action="/donations/${record.Id}/delete" onsubmit="return confirm('Opravdu chceš záznam smazat?');">
                <button type="submit" class="danger">Smazat</button>
              </form>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="empty-state">Zatím zde nejsou žádné záznamy.</td></tr>`;

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Evidenční systém darování krve a plazmy</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Bricolage+Grotesque:wght@500;700&display=swap");

      :root {
        --bg-a: #f6fbff;
        --bg-b: #d8ecff;
        --bg-c: #fff2e7;
        --panel: rgba(255, 255, 255, 0.88);
        --ink: #1f2b3a;
        --muted: #59677a;
        --good: #12805f;
        --bad: #b3261e;
        --accent: #0e6fd8;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Sora", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 16%, #ffffff 0%, transparent 35%),
          radial-gradient(circle at 88% 0%, #ffd7b8 0%, transparent 28%),
          linear-gradient(155deg, var(--bg-a) 0%, var(--bg-b) 48%, var(--bg-c) 100%);
        display: grid;
        place-items: center;
        padding: 2rem 1rem;
      }

      .card {
        width: min(1200px, 100%);
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        box-shadow: 0 20px 48px rgba(27, 43, 68, 0.16);
        padding: clamp(1.2rem, 2.5vw, 2rem);
      }

      h1 {
        margin: 0;
        font-family: "Bricolage Grotesque", sans-serif;
        font-size: clamp(1.6rem, 3vw, 2.4rem);
      }

      .subtitle {
        margin: 0.55rem 0 1.3rem;
        color: var(--muted);
      }

      .status {
        padding: 0.8rem 0.95rem;
        border-radius: 12px;
        margin-bottom: 1rem;
        font-size: 0.95rem;
      }

      .status.error {
        background: rgba(179, 38, 30, 0.1);
        border: 1px solid rgba(179, 38, 30, 0.2);
        color: var(--bad);
      }

      .status.success {
        background: rgba(18, 128, 95, 0.11);
        border: 1px solid rgba(18, 128, 95, 0.25);
        color: var(--good);
      }

      .layout {
        display: grid;
        gap: 1.25rem;
      }

      .section {
        padding: 1.1rem;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(28, 52, 92, 0.1);
      }

      .section-title {
        margin: 0 0 1rem;
        font-family: "Bricolage Grotesque", sans-serif;
        font-size: 1.15rem;
      }

      form {
        display: grid;
        gap: 1rem;
      }

      .field {
        display: grid;
        gap: 0.45rem;
      }

      .field-group {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .field-group.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      label {
        font-size: 0.95rem;
        font-weight: 600;
      }

      input,
      select,
      textarea,
      button {
        font: inherit;
      }

      input,
      select,
      textarea {
        border: 1px solid rgba(28, 52, 92, 0.22);
        border-radius: 12px;
        padding: 0.72rem 0.8rem;
        background: #ffffff;
        color: var(--ink);
        width: 100%;
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      input:focus,
      select:focus,
      textarea:focus {
        outline: 2px solid rgba(14, 111, 216, 0.22);
        border-color: var(--accent);
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 0.82rem 1.2rem;
        font-weight: 700;
        color: #ffffff;
        background: linear-gradient(135deg, #0e6fd8, #1ea6ff);
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease;
        box-shadow: 0 10px 20px rgba(14, 111, 216, 0.24);
      }

      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 24px rgba(14, 111, 216, 0.26);
      }

      .small {
        font-size: 0.85rem;
        color: var(--muted);
      }

      .records-table {
        width: 100%;
        border-collapse: collapse;
      }

      .records-table th,
      .records-table td {
        padding: 0.72rem 0.7rem;
        border-bottom: 1px solid rgba(28, 52, 92, 0.12);
        text-align: left;
        vertical-align: top;
        font-size: 0.94rem;
      }

      .records-table th {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--muted);
      }

      .note-cell {
        max-width: 260px;
        white-space: normal;
      }

      .actions {
        display: grid;
        gap: 0.5rem;
      }

      .action-link,
      .danger {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        padding: 0.55rem 0.75rem;
        border-radius: 999px;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 700;
        border: 0;
        cursor: pointer;
      }

      .action-link {
        color: #0e6fd8;
        background: rgba(14, 111, 216, 0.1);
      }

      .danger {
        color: #ffffff;
        background: linear-gradient(135deg, #c62828, #ef5350);
      }

      .empty-state {
        text-align: center;
        color: var(--muted);
        padding: 1.2rem 0.7rem;
      }

      @media (max-width: 900px) {
        .field-group,
        .field-group.three {
          grid-template-columns: 1fr;
        }

        .records-table {
          display: block;
          overflow-x: auto;
          white-space: nowrap;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Evidenční systém darování krve a plazmy</h1>
      <p class="subtitle">${subtitle}</p>
      ${errorMessage ? `<div class="status error">${errorMessage}</div>` : ""}
      ${successMessage ? `<div class="status success">${successMessage}</div>` : ""}

      <div class="layout">
        <section class="section">
          <h2 class="section-title">${formTitle}</h2>
          <form method="post" action="${isEditMode ? `/donations/${formValues.id}/update` : "/donations"}">
            <div class="field-group">
              <div class="field">
                <label for="donationDate">Datum odběru</label>
                <input id="donationDate" name="donationDate" type="date" value="${donationDateValue}" required />
              </div>
              <div class="field">
                <label for="donationType">Typ odběru</label>
                <select id="donationType" name="donationType" required>
                  ${typeOptions}
                </select>
              </div>
            </div>

            <div class="field-group">
              <div class="field">
                <label for="arrivalTime">Čas příchodu</label>
                <input id="arrivalTime" name="arrivalTime" type="time" value="${arrivalTimeValue}" />
              </div>
              <div class="field">
                <label for="departureTime">Čas odchodu</label>
                <input id="departureTime" name="departureTime" type="time" value="${departureTimeValue}" />
              </div>
            </div>

            <div class="field-group three">
              <div class="field">
                <label for="fatigueRating">Únava po odběru</label>
                <select id="fatigueRating" name="fatigueRating">
                  ${fatigueOptions}
                </select>
                <span class="small">5 znamená, že ses cítil nejlépe.</span>
              </div>
              <div class="field" style="grid-column: span 2;">
                <label for="note">Poznámka</label>
                <textarea id="note" name="note" placeholder="Například jak ses cítil, co probíhalo, zkušenost..." maxlength="1000">${noteValue}</textarea>
              </div>
            </div>

            <button type="submit">${submitLabel}</button>
          </form>
        </section>

        <section class="section">
          <h2 class="section-title">Přehled záznamů</h2>
          <table class="records-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Datum</th>
                <th>Typ</th>
                <th>Příchod</th>
                <th>Odchod</th>
                <th>Únava</th>
                <th>Poznámka</th>
                <th>Vytvořeno</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              ${recordsMarkup}
            </tbody>
          </table>
        </section>
      </div>

    </main>
  </body>
</html>`;
}

app.get("/", async (req, res) => {
  try {
    const records = await getDonationRecords();
    const editRecord = req.query.edit && isValidId(req.query.edit)
      ? await getDonationRecordById(req.query.edit)
      : null;

    res.status(200).type("html").send(
      renderPage({
        records,
        isEditMode: Boolean(editRecord),
        formValues: editRecord
          ? {
              id: editRecord.Id,
              donationDate: formatDateForInput(editRecord.DonationDate),
              donationType: editRecord.DonationType,
              arrivalTime: formatTimeForInput(editRecord.ArrivalTime),
              departureTime: formatTimeForInput(editRecord.DepartureTime),
              fatigueRating: editRecord.FatigueRating ? String(editRecord.FatigueRating) : "",
              note: editRecord.Note || "",
            }
          : {},
        errorMessage: req.query.edit && !editRecord ? "Požadovaný záznam nebyl nalezen." : "",
        successMessage: req.query.saved ? "Záznam byl úspěšně uložen." : req.query.deleted ? "Záznam byl úspěšně smazán." : "",
      }),
    );
  } catch (error) {
    console.error("Failed to render main page:", error);
    res.status(500).type("html").send(
      renderPage({ errorMessage: "Nepodařilo se načíst záznamy z databáze." }),
    );
  }
});

app.post("/donations", async (req, res) => {
  const donationDate = req.body.donationDate;
  const donationType = req.body.donationType;
  const arrivalTime = req.body.arrivalTime || null;
  const departureTime = req.body.departureTime || null;
  const fatigueRating = req.body.fatigueRating || null;
  const note = req.body.note ? req.body.note.trim() : null;

  if (!donationDate || !donationType) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Vyplň datum i typ odběru." }));
    return;
  }

  if (!allowedDonationTypes.has(donationType)) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Typ odběru musí být krev nebo plazma." }));
    return;
  }

  if (fatigueRating && !allowedFatigueRatings.has(String(fatigueRating))) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Hodnocení únavy musí být číslo od 1 do 5." }));
    return;
  }

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("DonationDate", sql.Date, donationDate)
      .input("DonationType", sql.NVarChar(20), donationType)
      .input("ArrivalTime", sql.Time(0), arrivalTime)
      .input("DepartureTime", sql.Time(0), departureTime)
      .input("FatigueRating", sql.TinyInt, fatigueRating ? Number(fatigueRating) : null)
      .input("Note", sql.NVarChar(1000), note)
      .query(`
        INSERT INTO dbo.DonationRecords (
          DonationDate,
          DonationType,
          ArrivalTime,
          DepartureTime,
          FatigueRating,
          Note
        )
        VALUES (
          @DonationDate,
          @DonationType,
          @ArrivalTime,
          @DepartureTime,
          @FatigueRating,
          @Note
        )
      `);

    res.redirect(303, "/?saved=1");
  } catch (error) {
    console.error("Failed to save donation record:", error);
    res.status(500).type("html").send(
      renderPage({
        errorMessage: "Nepodařilo se uložit data do Azure SQL. Zkontroluj konfiguraci databáze v Application Settings.",
      }),
    );
  }
});

app.post("/donations/:id/update", async (req, res) => {
  const recordId = req.params.id;

  if (!isValidId(recordId)) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Neplatné ID záznamu." }));
    return;
  }

  const donationDate = req.body.donationDate;
  const donationType = req.body.donationType;
  const arrivalTime = req.body.arrivalTime || null;
  const departureTime = req.body.departureTime || null;
  const fatigueRating = req.body.fatigueRating || null;
  const note = req.body.note ? req.body.note.trim() : null;

  if (!donationDate || !donationType) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Vyplň datum i typ odběru." }));
    return;
  }

  if (!allowedDonationTypes.has(donationType)) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Typ odběru musí být krev nebo plazma." }));
    return;
  }

  if (fatigueRating && !allowedFatigueRatings.has(String(fatigueRating))) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Hodnocení únavy musí být číslo od 1 do 5." }));
    return;
  }

  try {
    const pool = await getPool();
    const updateResult = await pool
      .request()
      .input("Id", sql.Int, Number(recordId))
      .input("DonationDate", sql.Date, donationDate)
      .input("DonationType", sql.NVarChar(20), donationType)
      .input("ArrivalTime", sql.Time(0), arrivalTime)
      .input("DepartureTime", sql.Time(0), departureTime)
      .input("FatigueRating", sql.TinyInt, fatigueRating ? Number(fatigueRating) : null)
      .input("Note", sql.NVarChar(1000), note)
      .query(`
        UPDATE dbo.DonationRecords
        SET
          DonationDate = @DonationDate,
          DonationType = @DonationType,
          ArrivalTime = @ArrivalTime,
          DepartureTime = @DepartureTime,
          FatigueRating = @FatigueRating,
          Note = @Note
        WHERE Id = @Id
      `);

    if (updateResult.rowsAffected[0] === 0) {
      res.status(404).type("html").send(renderPage({ errorMessage: "Záznam nebyl nalezen." }));
      return;
    }

    res.redirect(303, "/?saved=1");
  } catch (error) {
    console.error("Failed to update donation record:", error);
    res.status(500).type("html").send(
      renderPage({
        errorMessage: "Nepodařilo se upravit záznam v Azure SQL. Zkontroluj konfiguraci databáze v Application Settings.",
      }),
    );
  }
});

app.post("/donations/:id/delete", async (req, res) => {
  const recordId = req.params.id;

  if (!isValidId(recordId)) {
    res.status(400).type("html").send(renderPage({ errorMessage: "Neplatné ID záznamu." }));
    return;
  }

  try {
    const pool = await getPool();
    const deleteResult = await pool
      .request()
      .input("Id", sql.Int, Number(recordId))
      .query(`DELETE FROM dbo.DonationRecords WHERE Id = @Id`);

    if (deleteResult.rowsAffected[0] === 0) {
      res.status(404).type("html").send(renderPage({ errorMessage: "Záznam nebyl nalezen." }));
      return;
    }

    res.redirect(303, "/?deleted=1");
  } catch (error) {
    console.error("Failed to delete donation record:", error);
    res.status(500).type("html").send(
      renderPage({
        errorMessage: "Nepodařilo se smazat záznam v Azure SQL. Zkontroluj konfiguraci databáze v Application Settings.",
      }),
    );
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
