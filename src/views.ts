import type { Pass } from "./db.js";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (d: Date): string => d.toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" });

const page = (title: string, body: string): string => `<!DOCTYPE html>
<html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>body{font-family:sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem;text-align:left}
form{display:inline}</style></head><body>${body}</body></html>`;

export function homePage(
  counts: { total: number; active: number },
  user: { name?: string; email?: string } | null,
  passes: Pass[]
): string {
  const auth = user
    ? `<p>Prijavljen: ${esc(user.name ?? user.email ?? "korisnik")} — <a href="/logout">Odjava</a></p>`
    : `<p><a href="/login">Prijava</a></p>`;

  const table = user
    ? `<h2>Propusnice</h2><table><tr><th>Ime</th><th>Dokument</th><th>Izdano</th><th>Status</th><th>Akcije</th></tr>${passes
        .map(
          (p) => `<tr>
<td>${esc(p.name)}</td><td>${esc(p.document)}</td><td>${fmt(p.issued_at)}</td><td>${p.status}</td>
<td><a href="/info/${p.id}">Info</a>
${p.status === "ACTIVE" ? `<form method="post" action="/manage/${p.id}/cancel"><button>Poništi</button></form>` : ""}
<form method="post" action="/manage/${p.id}/delete"><button>Obriši</button></form></td></tr>`
        )
        .join("")}</table>`
    : "";

  return page(
    "Propusnice",
    `<h1>Propusnice</h1>${auth}
<p>Ukupno propusnica: <strong>${counts.total}</strong></p>
<p>Aktivnih propusnica: <strong>${counts.active}</strong></p>${table}`
  );
}

export function infoPage(p: Pass): string {
  return page(
    "Propusnica",
    `<h1>Propusnica</h1>
<p>Status: <strong>${p.status}</strong></p>
<p>Ime i prezime: ${esc(p.name)}</p>
<p>Dokument: ${esc(p.document)}</p>
<p>Izdano: ${fmt(p.issued_at)}</p>`
  );
}
