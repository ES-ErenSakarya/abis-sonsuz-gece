import type { ErrorComponentProps } from "@tanstack/react-router";

const FALLBACK_MESSAGE = "Beklenmeyen bir hata oluştu.";
const RETRY_KEY = "abis-chunk-retry";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isChunkLoadError(error: unknown): boolean {
  const msg = errorMessage(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script|Unable to preload CSS|ChunkLoadError|Loading chunk \d+ failed/i.test(
    msg,
  );
}

let reloadArmed = false;

function armChunkReload(): boolean {
  if (typeof window === "undefined") return false;
  if (reloadArmed) return true;
  let n = 0;
  try {
    n = Number(sessionStorage.getItem(RETRY_KEY) || "0");
  } catch {
    return false;
  }
  if (n >= 2) return false;
  reloadArmed = true;
  try {
    sessionStorage.setItem(RETRY_KEY, String(n + 1));
  } catch {
    /* gizli sekme */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

export function clearChunkRetry() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RETRY_KEY);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_r")) return;
    url.searchParams.delete("_r");
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* yoksay */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (!isChunkLoadError(payload ?? event)) return;
    if (armChunkReload()) event.preventDefault();
  });
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const chunk = isChunkLoadError(error);
  const reloading = chunk && armChunkReload();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#1c1916] px-6 text-center text-[#f3efe8]">
      <h1 className="text-lg font-semibold">
        {reloading ? "Oyun yenileniyor" : chunk ? "Oyun dosyası yüklenemedi" : "Bir şeyler ters gitti"}
      </h1>
      <p className="max-w-md text-sm text-[#c4b8a8]">
        {reloading
          ? "Güncellemeden kalan eski sayfa kapanıyor."
          : chunk
            ? "Bağlantı koptu ya da oyun yeni güncellendi. Bir kez daha dene."
            : "Sayfayı yenilemeyi dene."}
      </p>
      <p className="max-w-md text-xs break-words text-[#8a7e72]">{errorMessage(error)}</p>
      {reloading ? null : (
        <button
          type="button"
          className="mt-1 rounded-md border border-[#8a7e72] px-4 py-2 text-sm"
          onClick={() => {
            reloadArmed = false;
            try {
              sessionStorage.removeItem(RETRY_KEY);
            } catch {
              /* yoksay */
            }
            const url = new URL(window.location.href);
            url.searchParams.set("_r", String(Date.now()));
            window.location.replace(url.toString());
          }}
        >
          Yenile
        </button>
      )}
    </main>
  );
}
