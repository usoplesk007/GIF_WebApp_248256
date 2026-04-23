# GIF_WebApp_248256

Node.js aplikace na Expressu pro evidenci odberu krve a plazmy, s ulozenim dat do Azure SQL.

## Pozadavky

- Node.js 18+
- npm

## Instalace

V koreni projektu spust:

```bash
npm install
```

## Konfigurace Azure SQL

Aplikace podporuje 2 zpusoby pripojeni:

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

Na Azure App Service nastav tyto promenne v Application Settings.

## Spusteni aplikace

```bash
npm start
```

Aplikace bezi standardne na portu `3000`.
Port muzes zmenit pomoci promenne prostredi `PORT`:

```bash
PORT=8080 npm start
```

## Funkce aplikace

- Stranka s formularem pro zaznam odberu:
  - datum odberu
  - typ odberu (`krev` nebo `plazma`)
- Ukladani zaznamu do tabulky `dbo.DonationRecords` v Azure SQL
- Automaticke vytvoreni tabulky pri prvnim uspesnem DB pripojeni

## Endpointy

- `GET /` vraci HTML stranku s formularem
- `POST /donations` uklada zaznam do Azure SQL
- `GET /health` vraci JSON se stavem aplikace

Priklad odpovedi z health checku:

```json
{
  "status": "ok"
}
```
