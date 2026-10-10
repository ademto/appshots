/**
 * Email delivery — deferred for v1.
 *
 * Sending is isolated behind a single `sendLoginCode` interface so a real
 * provider (SES, Cloudflare, etc.) can be dropped in later without touching
 * auth logic. v1 uses the console sender: the code is logged to the server
 * output so the flow is fully testable without any email provider (R1.7).
 */
import { env } from "../env";

export interface EmailSender {
  sendLoginCode(email: string, code: string): Promise<void>;
}

const consoleSender: EmailSender = {
  async sendLoginCode(email, code) {
    console.log("\n==============================");
    console.log(`  Login code for ${email}`);
    console.log(`  CODE: ${code}`);
    console.log("  (expires in 10 minutes)");
    console.log("==============================\n");
  },
};

function selectSender(): EmailSender {
  switch (env.EMAIL_PROVIDER) {
    // case "ses": return sesSender; // added in a later phase
    case "console":
    default:
      return consoleSender;
  }
}

export const emailSender = selectSender();
