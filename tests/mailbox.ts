/**
 * The mail the Broker sent, read where it lands in the declared stack: the
 * mail catcher `compose.yaml` runs in place of a real mail server.
 *
 * A Person proves they hold an address by following a link that only reached
 * that address. Reading the link from here is the same proof, and a case that
 * builds the link itself instead proves nothing about the Broker.
 */

import { ISSUER, configured } from "./broker.ts";

// The inbox is declared once, as the address the proxy serves it at: the
// composition's applications send here too, and a second variable for the
// same URL is a variable that can disagree with the one the proxy reads.
const MAILBOX = configured("MAIL_BASE_URL");

/** How long a mail may take to arrive before a case calls it never sent. */
const PATIENCE_MS = 10_000;
const POLL_MS = 250;

interface Summary {
  ID: string;
  Subject: string;
}

const NOT_RUNNING = [
  `The mail catcher is not answering at ${MAILBOX}.`,
  "Start the stack with:  pnpm broker:up",
].join("\n");

async function json<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MAILBOX}${path}`);
  } catch (cause) {
    throw new Error(NOT_RUNNING, { cause });
  }
  if (!response.ok) {
    throw new Error(`The mail catcher answered HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function mailTo(address: string): Promise<Summary[]> {
  const query = new URLSearchParams({ query: `to:"${address}"` });
  const { messages } = await json<{ messages: Summary[] }>(
    `/api/v1/search?${query.toString()}`,
  );
  return messages;
}

/** How many mails an address has received. A case that expects none reads
 *  this rather than waiting for a link that should never come. */
export async function mailCountTo(address: string): Promise<number> {
  return (await mailTo(address)).length;
}

/**
 * The link to the Broker in the newest mail an address received after it had
 * already received `seen`, waiting for that mail to arrive.
 *
 * Only a link back to this Broker's issuer counts: a mail may carry others,
 * and following the wrong one would be a Person clicking on a footer.
 */
export async function linkMailedTo(address: string, seen = 0): Promise<string> {
  const deadline = Date.now() + PATIENCE_MS;
  while (Date.now() < deadline) {
    const messages = await mailTo(address);
    // Newest first, as the catcher lists them.
    const newest = messages.length > seen ? messages[0] : undefined;
    if (newest) {
      const { Text } = await json<{ Text: string }>(
        `/api/v1/message/${newest.ID}`,
      );
      const link = Text.match(/https?:\/\/\S+/g)?.find((url) =>
        url.startsWith(ISSUER),
      );
      if (!link) {
        throw new Error(
          `"${newest.Subject}" reached ${address} with no link to ${ISSUER}.`,
        );
      }
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`No mail reached ${address} within ${PATIENCE_MS} ms.`);
}
