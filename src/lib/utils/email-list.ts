export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateMensaEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && email.endsWith('@mensa.org.br');
}

export function parseEmailList(rawText: string) {
  const candidates = rawText
    .split(/[\s,;]+/g)
    .map(normalizeEmail)
    .filter(Boolean);

  const uniqueEmails = Array.from(new Set(candidates));

  const validEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const email of uniqueEmails) {
    if (validateMensaEmail(email)) {
      validEmails.push(email);
    } else {
      invalidEmails.push(email);
    }
  }

  return {
    validEmails,
    invalidEmails,
    totalReceived: candidates.length,
    totalUnique: uniqueEmails.length,
  };
}
