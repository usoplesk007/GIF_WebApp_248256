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
            END

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

function renderPage({ errorMessage = "", successMessage = "" } = {}) {
  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Darovani krve - evidence</title>
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
        width: min(700px, 100%);
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        box-shadow: 0 20px 48px rgba(27, 43, 68, 0.16);
        padding: clamp(1.2rem, 2.5vw, 2rem);
        animation: fadeUp 700ms ease-out;
      }

      h1 {
        margin: 0;
        font-family: "Bricolage Grotesque", sans-serif;
        font-size: clamp(1.5rem, 2.6vw, 2.2rem);
        letter-spacing: 0.02em;
      }

      .subtitle {
        margin: 0.5rem 0 1.5rem;
        color: var(--muted);
      }

      .status {
        padding: 0.75rem 0.9rem;
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

      .hint {
        margin-top: 1.2rem;
        font-size: 0.88rem;
        color: var(--muted);
      }

      .small {
        font-size: 0.85rem;
        color: var(--muted);
      }

      @media (max-width: 700px) {
        .field-group,
        .field-group.three {
          grid-template-columns: 1fr;
        }
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(18px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Evidence odberu krve a plazmy</h1>
      <p class="subtitle">Zadej datum, typ a dopln i casy, unavu a poznamku. Data se ulozi do Azure SQL databaze.</p>
      ${errorMessage ? `<div class="status error">${errorMessage}</div>` : ""}
      ${successMessage ? `<div class="status success">${successMessage}</div>` : ""}
      <form method="post" action="/donations">
        <div class="field-group">
          <div class="field">
            <label for="donationDate">Datum odberu</label>
            <input id="donationDate" name="donationDate" type="date" required />
          </div>
          <div class="field">
            <label for="donationType">Typ odberu</label>
            <select id="donationType" name="donationType" required>
              <option value="">Vyber typ odberu</option>
              <option value="krev">krev</option>
              <option value="plazma">plazma</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <div class="field">
            <label for="arrivalTime">Cas prichodu</label>
            <input id="arrivalTime" name="arrivalTime" type="time" />
          </div>
          <div class="field">
            <label for="departureTime">Cas odchodu</label>
            <input id="departureTime" name="departureTime" type="time" />
          </div>
        </div>

        <div class="field-group three">
          <div class="field">
            <label for="fatigueRating">Unava po odberu</label>
            <select id="fatigueRating" name="fatigueRating">
              <option value="">Vyber hodnoceni</option>
              <option value="1">1 - velmi unaveny</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5 - citil jsem se nejlepe</option>
            </select>
            <span class="small">5 znamena, ze ses citil nejlepe.</span>
          </div>
          <div class="field" style="grid-column: span 2;">
            <label for="note">Poznamka</label>
            <textarea id="note" name="note" placeholder="Napriklad jak ses citil, co probihalo, zkusenost..." maxlength="1000"></textarea>
          </div>
        </div>

        <button type="submit">Ulozit zaznam</button>
      </form>
      <p class="hint">Tip: pro Azure nastav v Application Settings promenne AZURE_SQL_CONNECTIONSTRING nebo DB_USER, DB_PASSWORD, DB_SERVER, DB_DATABASE.</p>
    </main>
  </body>
</html>`;
}

app.get("/", (req, res) => {
  res.status(200).type("html").send(renderPage());
});

app.post("/donations", async (req, res) => {
  const donationDate = req.body.donationDate;
  const donationType = req.body.donationType;
  const arrivalTime = req.body.arrivalTime || null;
  const departureTime = req.body.departureTime || null;
  const fatigueRating = req.body.fatigueRating || null;
  const note = req.body.note ? req.body.note.trim() : null;

  if (!donationDate || !donationType) {
    res.status(400).type("html").send(
      renderPage({ errorMessage: "Vypln datum i typ odberu." }),
    );
    return;
  }

  if (!allowedDonationTypes.has(donationType)) {
    res.status(400).type("html").send(
      renderPage({ errorMessage: "Typ odberu musi byt krev nebo plazma." }),
    );
    return;
  }

  if (fatigueRating && !allowedFatigueRatings.has(String(fatigueRating))) {
    res.status(400).type("html").send(
      renderPage({ errorMessage: "Hodnoceni unavy musi byt cislo od 1 do 5." }),
    );
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

    res.status(201).type("html").send(
      renderPage({ successMessage: "Zaznam byl uspesne ulozen do databaze." }),
    );
  } catch (error) {
    console.error("Failed to save donation record:", error);
    res.status(500).type("html").send(
      renderPage({
        errorMessage:
          "Nepodarilo se ulozit data do Azure SQL. Zkontroluj DB konfiguraci v Application Settings.",
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
