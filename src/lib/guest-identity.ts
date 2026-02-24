const GUEST_ID_STORAGE_KEY = "lekha_guest_id";
const GUEST_ID_COOKIE_KEY = "lekha_guest_id";

const createGuestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const setGuestCookie = (guestId: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${GUEST_ID_COOKIE_KEY}=${guestId}; path=/; max-age=${oneYear}; samesite=lax`;
};

export const getGuestId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  return null;
};

export const getOrCreateGuestId = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = getGuestId();
  if (existing) {
    setGuestCookie(existing);
    return existing;
  }

  const generated = createGuestId();
  window.localStorage.setItem(GUEST_ID_STORAGE_KEY, generated);
  setGuestCookie(generated);

  return generated;
};

export const asGuestOwnerId = (guestId: string) => `guest:${guestId}`;

export const isGuestOwnerId = (ownerId: string) => ownerId.startsWith("guest:");
