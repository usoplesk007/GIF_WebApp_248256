# GIF_WebApp_248256

Node.js aplikace na Expressu pro evidenci odběrů krve a plazmy s uložením dat do Azure SQL.

## Pozadavky

- Node.js 18+
- npm

## Instalace

V koreni projektu spust:

```bash
npm install
```

## Konfigurace Azure SQL

Aplikace podporuje 2 způsoby připojení:

1. Jedna connection string promenna:

```bash
AZURE_SQL_CONNECTIONSTRING="Server=tcp:248256.database.windows.net,1433;Initial Catalog=248256;Persist Security Info=False;User ID=<USER>;Password=<PASSWORD>;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
```

2. Jednotlive DB promenne:

```bash
DB_USER=<USER>
DB_PASSWORD=<PASSWORD>
DB_SERVER=248256.database.windows.net
DB_DATABASE=248256
DB_PORT=1433
```

Na Azure App Service nastav tyto proměnné v Application Settings.

## Spuštění aplikace

```bash
npm start
```

Aplikace běží standardně na portu `3000`.
Port můžeš změnit pomocí proměnné prostředí `PORT`:

```bash
PORT=8080 npm start
```

## Funkce aplikace

- Stránka s formulářem pro záznam odběru:
  - datum odběru
  - typ odběru (`krev` nebo `plazma`)
  - čas příchodu
  - čas odchodu
  - únava po odběru na škále 1 až 5
  - poznámka
- Seznam uložených záznamů přímo na stránce
- Úprava a mazání starších záznamů
- Ukládání záznamů do tabulky `dbo.DonationRecords` v Azure SQL
- Automatické vytvoření tabulky při prvním úspěšném DB připojení

## Endpointy

- `GET /` vrací HTML stránku s formulářem a seznamem záznamů
- `POST /donations` ukládá nový záznam do Azure SQL
- `POST /donations/:id/update` upravuje existující záznam
- `POST /donations/:id/delete` maže záznam
- `GET /health` vrací JSON se stavem aplikace

Příklad odpovědi z health checku:

```json
{
  "status": "ok"
}
```
