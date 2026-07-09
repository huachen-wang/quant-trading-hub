const CONTACT_ONLY_DOWNLOAD_HOSTS = ["kaibb.co"];
const BROKER_REGISTRATION_PATH = /\/register\/trader(?:\/|$)/i;

function parseUrl(value: string) {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : `https://${value.replace(/^\/\//, "")}`;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

export function shouldUseContactForDownload(downloadUrl?: string | null) {
  const value = downloadUrl?.trim();
  if (!value) return true;

  const parsed = parseUrl(value);
  if (!parsed) {
    return /kaibb\.co/i.test(value) || BROKER_REGISTRATION_PATH.test(value);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isContactOnlyHost = CONTACT_ONLY_DOWNLOAD_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  const isRegistrationPath = BROKER_REGISTRATION_PATH.test(parsed.pathname);
  const hasReferralParams = parsed.searchParams.has("link_id") && parsed.searchParams.has("referrer_id");

  return isContactOnlyHost || isRegistrationPath || hasReferralParams;
}

export function getInternalStrategyRoute(value?: string | null) {
  const match = value?.trim().match(/^\/?strategy\/(\d+)\/?(?:[?#].*)?$/i);
  return match ? `/strategy/${match[1]}` : null;
}
