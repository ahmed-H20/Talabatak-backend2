import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

const admin = initializeApp({
  credential: cert(serviceAccount),
});

export default { auth: getAuth };
