import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

for (const path of [
  resolve(here, "../../../.env.local"),
  resolve(process.cwd(), "../../.env.local"),
  resolve(process.cwd(), ".env.local"),
]) {
  config({ path });
}
