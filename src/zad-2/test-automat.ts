
import "dotenv/config";
import { getToken, issuePass } from "./automat.js";

async function main(): Promise<void> {
  const authority = process.env.AUTH0_ISSUER!;
  const audience = process.env.AUTH0_AUDIENCE!;
  const clientId = process.env.M2M_CLIENT_ID!;
  const clientSecret = process.env.M2M_CLIENT_SECRET!;
  const scope = "create:passes";

  // Dohvati pristupni token
  const token = await getToken(
    authority,
    audience,
    clientId,
    clientSecret,
    scope
  );

  console.log("Token je uspješno dohvaćen.");

  // Izdaj propusnicu i spremi QR kod
  await issuePass(
    "http://localhost:3000/passes",
    token,
    "Testna propusnica automat",
    "AUTOMAT-001"
  );

  console.log("Propusnica je izdana i QR kod je spremljen.");
}

main().catch((error: unknown) => {
  console.error("Greška:", error);
  process.exitCode = 1;
});
