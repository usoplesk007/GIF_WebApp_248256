const express = require("express");
const app = express();

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).type("html").send(`<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Live Clock App</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=DM+Serif+Display&display=swap");

      :root {
        --bg-start: #fff5e8;
        --bg-mid: #ffe2bf;
        --bg-end: #ffd3d0;
        --panel: rgba(255, 255, 255, 0.75);
        --text: #20222f;
        --muted: #556070;
        --accent: #e75d3c;
        --accent-soft: #ffb86e;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 15% 20%, var(--bg-start), transparent 40%),
          radial-gradient(circle at 85% 10%, #ffd6a6, transparent 35%),
          linear-gradient(145deg, var(--bg-mid), var(--bg-end));
        color: var(--text);
        font-family: "Space Grotesk", "Segoe UI", sans-serif;
        overflow: hidden;
      }

      .blob {
        position: fixed;
        border-radius: 999px;
        filter: blur(24px);
        opacity: 0.45;
        animation: drift 14s ease-in-out infinite;
      }

      .blob.one {
        width: 340px;
        height: 340px;
        background: #ffc07a;
        top: -80px;
        left: -60px;
      }

      .blob.two {
        width: 420px;
        height: 420px;
        background: #ff9f9b;
        bottom: -130px;
        right: -80px;
        animation-delay: -4s;
      }

      .panel {
        width: min(92vw, 760px);
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 28px;
        box-shadow: 0 24px 60px rgba(120, 67, 34, 0.2);
        backdrop-filter: blur(10px);
        padding: 2rem;
        text-align: center;
        animation: rise 700ms ease-out;
      }

      h1 {
        margin: 0 0 0.6rem;
        font: 500 clamp(1.7rem, 3vw, 2.5rem) "DM Serif Display", serif;
        letter-spacing: 0.03em;
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: clamp(0.95rem, 1.6vw, 1.1rem);
      }

      .clock-wrap {
        margin-top: 1.6rem;
        display: grid;
        gap: 0.8rem;
        justify-items: center;
      }

      .clock {
        font-size: clamp(2.4rem, 10vw, 5.8rem);
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--accent);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .date {
        padding: 0.5rem 0.9rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(231, 93, 60, 0.2);
        color: #2d3340;
        font-size: clamp(0.9rem, 1.6vw, 1rem);
      }

      .dot {
        display: inline-block;
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 50%;
        margin-right: 0.35rem;
        background: linear-gradient(180deg, var(--accent-soft), var(--accent));
        box-shadow: 0 0 0 0 rgba(231, 93, 60, 0.45);
        animation: pulse 1.4s infinite;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes drift {
        0%,
        100% {
          transform: translateY(0) translateX(0);
        }
        50% {
          transform: translateY(14px) translateX(10px);
        }
      }

      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(231, 93, 60, 0.45);
        }
        80% {
          box-shadow: 0 0 0 10px rgba(231, 93, 60, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(231, 93, 60, 0);
        }
      }

      @media (max-width: 540px) {
        .panel {
          padding: 1.4rem;
          border-radius: 20px;
        }
      }
    </style>
  </head>
  <body>
    <div class="blob one"></div>
    <div class="blob two"></div>

    <main class="panel" aria-live="polite">
      <h1>Live Server Clock</h1>
      <p><span class="dot"></span>time updates every second</p>
      <section class="clock-wrap">
        <div id="clock" class="clock">--:--:--</div>
        <div id="date" class="date">Loading date...</div>
      </section>
    </main>

    <script>
      const clockElement = document.getElementById("clock");
      const dateElement = document.getElementById("date");

      const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      function updateClock() {
        const now = new Date();
        clockElement.textContent = timeFormatter.format(now);
        dateElement.textContent = dateFormatter.format(now);
      }

      updateClock();
      setInterval(updateClock, 1000);
    </script>
  </body>
</html>`);
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
