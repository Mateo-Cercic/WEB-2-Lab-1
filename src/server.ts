import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import oidc from "express-openid-connect";
const { auth: oidcAuth, requiresAuth } = oidc;

import { auth as jwtAuth, requiredScopes } from "express-oauth2-jwt-bearer";
import QRCode from "qrcode";
import { initDb, getCounts, listPasses, getPass, createPass, cancelPass, deletePass, isUuid } from "./db.js";
import { homePage, infoPage } from "./views.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Nedostaje varijabla okruženja ${name}`);
  return v;
}

const port = Number(process.env.PORT ?? 3000);
const baseURL = (process.env.BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${port}`).replace(/\/+$/, ""); // RENDER_EXTERNAL_URL Render postavlja sam

const app = express();
app.set("trust proxy", 1); 

// OIDC prijava korisnika
app.use(
  oidcAuth({
    authRequired: false, // početna stranica je javna
    auth0Logout: true,
    baseURL,
    issuerBaseURL: env("AUTH0_ISSUER"),
    clientID: env("OIDC_CLIENT_ID"),
    clientSecret: env("OIDC_CLIENT_SECRET"),
    secret: env("SESSION_SECRET"),
    authorizationParams: { response_type: "code" },
  })
);

// Provjera OAuth2 pristupnog tokena
const checkJwt = jwtAuth({ issuerBaseURL: env("AUTH0_ISSUER"), audience: env("AUTH0_AUDIENCE") });


// ----------------- RUTE ---------------------

app.get("/", async (req, res) => {
  const counts = await getCounts();
  const loggedIn = req.oidc.isAuthenticated();
  const passes = loggedIn ? await listPasses() : [];
  res.send(homePage(counts, loggedIn ? (req.oidc.user ?? {}) : null, passes));
});

app.get("/info/:id", async (req, res) => {
  const id = String(req.params.id);
  const pass = isUuid(id) ? await getPass(id) : null;
  if (!pass) return res.status(404).send("Propusnica ne postoji");
  res.send(infoPage(pass));
});

// samo prijavljeni korisnik
app.post("/manage/:id/cancel", requiresAuth(), async (req, res) => {
  const id = String(req.params.id);
  if (isUuid(id)) await cancelPass(id);
  res.redirect("/");
});

app.post("/manage/:id/delete", requiresAuth(), async (req, res) => {
  const id = String(req.params.id);
  if (isUuid(id)) await deletePass(id);
  res.redirect("/");
});

// Pristupna točka 1: /passes/:id (read:passes) 
app.get("/passes/:id", checkJwt, requiredScopes("read:passes"), async (req, res) => {
  const id = String(req.params.id);
  const pass = isUuid(id) ? await getPass(id) : null;
  if (!pass) return res.status(404).json({ error: "Propusnica ne postoji" });
  res.json({
    id: pass.id,
    name: pass.name,
    document: pass.document,
    issuedAt: pass.issued_at.toISOString(),
    status: pass.status,
  });
});

// Pristupna točka 2: /passes (create:passes) 
app.post("/passes", checkJwt, requiredScopes("create:passes"), express.json(),  async (req, res) => {
  const { name, document } = (req.body ?? {}) as { name?: unknown; document?: unknown };
  if (typeof name !== "string" || !name.trim() || typeof document !== "string" || !document.trim()) {
    return res.status(400).json({ error: "name i document su obavezni" });
  }
  const id = randomUUID();
  await createPass(id, name.trim(), document.trim());

  // u QR kodu je JAVNA stranica, u Location je prva pristupna točka
  const png = await QRCode.toBuffer(`${baseURL}/info/${id}`, { type: "png", width: 400 });
  res.status(201).set("Location", `${baseURL}/passes/${id}`).type("image/png").send(png);
});


// ---------- Obrada pogrešaka (401/403 iz biblioteke, 500 za ostalo) ----------
type HttpError = Error & { status?: number; statusCode?: number; headers?: Record<string, string> };

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  if (err.headers) res.set(err.headers);
  res.status(status).json({ error: status >= 500 ? "Interna pogreška" : err.message });
});

initDb()
  .then(() => app.listen(port, () => console.log(`Server na ${baseURL} (port ${port})`)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
