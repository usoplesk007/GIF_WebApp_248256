# GIF_WebApp_248256

Simple Express web application designed for Azure App Service.

## Requirements

- Node.js 16 or later
- npm

## Setup

1. Open a terminal in the project folder.
2. Install dependencies:

```bash
npm install
```

## Run the app

Start the server:

```bash
npm start
```

The app listens on port `3000` by default, or the port provided by `process.env.PORT`.

## Endpoints

- `GET /` — returns a welcome message.
- `GET /health` — returns a JSON health check: `{ "status": "ok" }`.
