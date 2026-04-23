# GIF_WebApp_248256

Jednoducha Node.js aplikace postavena na Expressu, vhodna pro nasazeni na Azure App Service.

## Pozadavky

- Node.js 18+
- npm

## Instalace

V koreni projektu spust:

```bash
npm install
```

## Spusteni aplikace

```bash
npm start
```

Aplikace bezi standardne na portu `3000`.
Port muzes zmenit pomoci promenne prostredi `PORT`:

```bash
PORT=8080 npm start
```

## Endpointy

- `GET /` vraci text `Hello from Azure App Service!`
- `GET /health` vraci JSON se stavem aplikace

Priklad odpovedi z health checku:

```json
{
  "status": "ok"
}
```
