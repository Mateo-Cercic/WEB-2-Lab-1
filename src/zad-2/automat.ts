import { writeFile } from "node:fs/promises";

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  // Ukloni "/" na kraju 
  const base = authority.replace(/\/+$/, "");

  // OAuth2 client_credentials zahtjev šalje se kao form-urlencoded tijelo
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience: audience,
    scope: scope,
  });

  const response = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Dohvat tokena nije uspio, status: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Odgovor ne sadrži access_token");
  }

  return data.access_token;
}

export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, document }),
  });

  if (!response.ok) {
    throw new Error(`Izdavanje propusnice nije uspjelo, status: ${response.status}`);
  }

  // Identifikator propusnice je zadnji dio putanje u zaglavlju Location
  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("Odgovor ne sadrži zaglavlje Location");
  }
  const passId = location.replace(/\/+$/, "").split("/").pop();

  // Tijelo odgovora je slika (binarni podaci)
  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(`${passId}.png`, buffer);
}