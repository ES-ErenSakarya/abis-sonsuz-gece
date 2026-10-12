import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import {
  accountMeta,
  createCharacter,
  changeDeletePassword,
  deleteCharacter,
  listCharacters,
  saveCharacter,
  setDeletePassword,
  type CharacterRow,
} from "@/game/account";
import { beginPlay } from "@/game/input";
import { useHud } from "@/game/hudStore";
import { applySave, captureSave, CLASS_LIST, className, type ClassId } from "@/game/rpg";
import { useSession } from "@/game/session";

const field = "mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-fg";
const primary =
  "rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-fg disabled:opacity-40";
const ghost = "rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg disabled:opacity-40";

const CLASS_TONE: Record<ClassId, string> = {
  savasci: "#c4553a",
  okcu: "#7eb06a",
  buyucu: "#7aa0d4",
  ninja: "#c9a15b",
};

function ClassSigil({ id }: { id: ClassId }) {
  const tone = CLASS_TONE[id] ?? "#c9a15b";
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <circle cx="16" cy="16" r="13.2" fill="#141210" stroke={tone} strokeWidth="1.4" />
      {id === "savasci" ? <path d="M16 6.5 18.4 22h-4.8L16 6.5ZM9.5 24.5h13" fill={tone} stroke={tone} strokeWidth="1.2" /> : null}
      {id === "okcu" ? <path d="M7 16c4-8 14-8 18 0-4 8-14 8-18 0Zm9-6v12" fill="none" stroke={tone} strokeWidth="1.5" /> : null}
      {id === "buyucu" ? <path d="m16 6 1.5 7.2H25l-6 4.4 2.2 7.4L16 21l-5.2 4 2.2-7.4-6-4.4h7.5L16 6Z" fill={tone} /> : null}
      {id === "ninja" ? <path d="M7 16h18M16 7v18M10.5 10.5l11 11M21.5 10.5l-11 11" fill="none" stroke={tone} strokeWidth="1.35" /> : null}
    </svg>
  );
}

function rememberToken(token: unknown) {
  if (typeof token !== "string" || !token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("grok-auth.bearer-token", token);
  } catch {
    /* preview storage can be blocked */
  }
}

function DeletePasswordForm({
  onConfirmed,
}: {
  onConfirmed: (password: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 rounded-xl border border-border bg-bg/60 p-3">
      <button type="button" className={ghost} onClick={() => setOpen(true)}>
        Karakter Silme Şifresi Belirle
      </button>
      {open ? (
        <div className="mt-3">
          <label className="block text-sm text-muted" htmlFor="delete-pass">
            Karakter silme şifresi
          </label>
          <input
            id="delete-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            className={field}
            onChange={(e) => {
              setPassword(e.target.value);
              setNote("");
            }}
          />
          <button
            type="button"
            className={`${primary} mt-3`}
            onClick={() => {
              if (password.trim().length < 4) {
                setNote("En az 4 karakter.");
                return;
              }
              onConfirmed(password.trim());
              setNote("Şifre Oluşturuldu");
            }}
          >
            Onayla
          </button>
          {note ? <p className="mt-2 text-sm text-gold">{note}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Karakter silmek için ayrı bir şifre. Hesap şifren değil.</p>
      )}
    </div>
  );
}

export function AuthScreens() {
  const [mode, setMode] = useState<"giris" | "kayit">("giris");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [name, setName] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleteReady, setDeleteReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError("");
    setPending(true);
    try {
      if (mode === "giris") {
        const { data, error: err } = await authClient.signIn.email({ email: email.trim(), password });
        if (err) throw new Error(err.message || "Giriş olmadı");
        rememberToken((data as { token?: string } | null)?.token);
      } else {
        if (password !== again) throw new Error("Şifreler aynı değil");
        if (!deleteReady) throw new Error("Önce karakter silme şifresini onayla");
        const { data, error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || "Gezgin",
        });
        if (err) throw new Error(err.message || "Kayıt olmadı");
        rememberToken((data as { token?: string } | null)?.token);
        const saved = await setDeletePassword({ data: deletePw });
        if (!saved.ok && saved.reason !== "exists") throw new Error("Silme şifresi kaydedilemedi");
      }
      await authClient.getSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir şey ters gitti";
      const lower = message.toLowerCase();
      setError(
        lower.includes("origin")
          ? "Giriş adresi doğrulanamadı. Sayfayı yenileyip tekrar dene."
          : /too many|rate/i.test(message)
            ? "Çok denendi. Biraz bekleyip tekrar dene."
            : /exist/i.test(message)
              ? "Bu e-posta zaten kayıtlı."
              : /credential|password/i.test(message)
                ? "E-posta veya şifre uyuşmadı."
                : message,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="menu-card w-full max-w-md rounded-3xl border border-border bg-surface p-4 text-fg">
      <p className="text-xs tracking-[0.22em] text-muted">MMORPG</p>
      <h1 className="mt-2 font-display text-3xl font-medium leading-tight text-fg">Abis: Sonsuz Gece</h1>
      <p className="mt-2 text-sm text-muted">Aynı köyde başkaları da yürür. Hesabın ve karakterlerin sende kalır.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className={mode === "giris" ? primary : ghost} onClick={() => setMode("giris")}>
          Giriş
        </button>
        <button type="button" className={mode === "kayit" ? primary : ghost} onClick={() => setMode("kayit")}>
          Kayıt ol
        </button>
      </div>
      <label className="mt-4 block text-sm text-muted" htmlFor="email">
        E-posta
      </label>
      <input id="email" autoComplete="username" value={email} className={field} placeholder="ornek@posta.com" onChange={(e) => setEmail(e.target.value)} />
      {mode === "kayit" ? (
        <>
          <label className="mt-3 block text-sm text-muted" htmlFor="acc-name">
            Görünen ad
          </label>
          <input id="acc-name" value={name} maxLength={24} className={field} onChange={(e) => setName(e.target.value)} />
        </>
      ) : null}
      <label className="mt-3 block text-sm text-muted" htmlFor="acc-pass">
        Şifre
      </label>
      <input
        id="acc-pass"
        type="password"
        autoComplete={mode === "kayit" ? "new-password" : "current-password"}
        value={password}
        className={field}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === "kayit" ? (
        <>
          <label className="mt-3 block text-sm text-muted" htmlFor="acc-again">
            Şifre tekrar
          </label>
          <input id="acc-again" type="password" value={again} className={field} onChange={(e) => setAgain(e.target.value)} />
          <DeletePasswordForm
            onConfirmed={(pw) => {
              setDeletePw(pw);
              setDeleteReady(true);
            }}
          />
        </>
      ) : null}
      {error ? <p className="mt-3 text-sm text-hp">{error}</p> : null}
      <button
        type="button"
        className={`${primary} mt-4 w-full`}
        disabled={pending || password.length < 8 || !email.includes("@") || (mode === "kayit" && !deleteReady)}
        onClick={() => void submit()}
      >
        {pending ? "Bekleniyor…" : mode === "giris" ? "Giriş yap" : "Kayıt ol"}
      </button>
      <div className="mt-4 flex flex-col gap-2">
        {GROK_PROVIDERS.map((p) => (
          <button key={p.providerId} type="button" className={ghost} onClick={() => void signIn(p.providerId, { callbackURL: "/" })}>
            {p.label} ile devam et
          </button>
        ))}
      </div>
    </section>
  );
}

export function CharacterScreens() {
  const [rows, setRows] = useState<CharacterRow[] | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [klass, setKlass] = useState<ClassId>("savasci");
  const [deleting, setDeleting] = useState<CharacterRow | null>(null);
  const [wipe, setWipe] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [meta, list] = await Promise.all([accountMeta(), listCharacters()]);
    setNeedsPassword(!meta.hasDeletePassword);
    setRows(list);
  };

  useEffect(() => {
    let dead = false;
    const timer = window.setTimeout(() => {
      if (!dead) setError((prev) => prev || "Karakter listesi gelmedi. Tekrar dene.");
    }, 12000);
    void reload()
      .then(() => {
        if (!dead) setError("");
      })
      .catch((err) => {
        if (!dead) setError(err instanceof Error ? err.message : "Liste açılmadı");
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      dead = true;
      window.clearTimeout(timer);
    };
  }, []);

  const playing = useHud((s) => s.playing);
  const ready = useHud((s) => s.ready);
  const seenPlay = useRef(false);
  useEffect(() => {
    if (playing) {
      seenPlay.current = true;
      return;
    }
    if (!seenPlay.current) return;
    let dead = false;
    setRows(null);
    void listCharacters()
      .then((list) => {
        if (!dead) setRows(list);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [playing]);
  const play = (row: CharacterRow) => {
    if (!useHud.getState().ready) return;
    applySave(row);
    useSession.getState().enter(row.id);
    beginPlay({ x: row.x, z: row.z });
  };

  const make = async () => {
    if (creating == null) return;
    setBusy(true);
    setError("");
    try {
      const res = await createCharacter({ data: { slot: creating, name, classId: klass } });
      if (!res.ok || !("character" in res)) {
        setError(res.ok ? "Karakter yaratılamadı." : res.reason === "name" ? "Bu isim alınmış." : "Bu yuva dolu ya da ad çok kısa.");
        return;
      }
      setCreating(null);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Karakter yaratılamadı");
    } finally {
      setBusy(false);
    }
  };

  const wipeChar = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      const res = await deleteCharacter({ data: { id: deleting.id, password: wipe } });
      if (!res.ok) {
        setError(res.reason === "bad-password" ? "Silme şifresi yanlış." : "Karakter silinemedi.");
        return;
      }
      setDeleting(null);
      setWipe("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Karakter silinemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="menu-card relative max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-3xl border border-gold/40 bg-surface p-5 text-fg shadow-[0_28px_70px_rgba(8,7,6,0.55)]">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.28em] text-gold">ABİS · SONSUZ GECE</p>
          <h1 className="mt-1 font-display text-3xl text-fg">Karakter seç</h1>
          <p className="mt-1 text-sm text-muted">Altı yuva. Bir isim bir kez yaşar.</p>
        </div>
        <UserButton />
      </div>
      {needsPassword ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Karakter yaratmadan önce silme şifreni bir kez belirle.</p>
          <DeletePasswordForm
            onConfirmed={(pw) => {
              void setDeletePassword({ data: pw }).then((res) => {
                if (res.ok || res.reason === "exists") setNeedsPassword(false);
                else setError("Şifre kaydedilemedi.");
              });
            }}
          />
        </div>
      ) : creating != null ? (
        <div className="mt-4">
          <p className="text-sm text-gold">Yuva {creating + 1} · yeni karakter</p>
          <label className="mt-3 block text-sm text-muted" htmlFor="char-name">
            Karakter adı
          </label>
          <input id="char-name" value={name} maxLength={16} className={field} onChange={(e) => setName(e.target.value)} />
          <p className="mt-4 text-sm text-muted">Sınıf</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CLASS_LIST.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`flex items-center gap-3 text-left ${klass === row.id ? primary : ghost}`}
                onClick={() => setKlass(row.id)}
              >
                <ClassSigil id={row.id} />
                <span>
                  <span className="block">{row.name}</span>
                  <span className="mt-0.5 block text-xs opacity-80">{row.arm} · {row.line}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Başlangıç silahı köydeki sandıktan çıkar. Otomatik kuşanılmaz.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className={primary} disabled={busy || name.trim().length < 2} onClick={() => void make()}>
              Karakteri yarat
            </button>
            <button type="button" className={ghost} onClick={() => setCreating(null)}>
              Geri
            </button>
          </div>
        </div>
      ) : deleting ? (
        <div className="mt-4">
          <p className="text-sm text-fg">
            {deleting.name} silinsin mi? Karakter silme şifreni yaz.
          </p>
          <input type="password" value={wipe} className={field} onChange={(e) => setWipe(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button type="button" className={primary} disabled={busy || wipe.length < 4} onClick={() => void wipeChar()}>
              Karakteri sil
            </button>
            <button type="button" className={ghost} onClick={() => setDeleting(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : rows === null ? (
        <div className="mt-4">
          <p className="text-sm text-muted">{error || "Karakterler yükleniyor…"}</p>
          {error ? (
            <button
              type="button"
              className={`${primary} mt-3`}
              onClick={() => {
                setError("");
                void reload().catch((err) => setError(err instanceof Error ? err.message : "Liste açılmadı"));
              }}
            >
              Tekrar dene
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, slot) => {
            const row = rows?.find((item) => item.slot === slot);
            if (!row) {
              return (
                <button key={slot} type="button" className="flex min-h-28 flex-col justify-between rounded-2xl border border-dashed border-gold/35 bg-bg/70 px-4 py-3 text-left" onClick={() => setCreating(slot)}>
                  <span className="text-xs tracking-widest text-muted">YUVA {slot + 1}</span>
                  <span className="text-sm text-gold">Boş mühür · yeni karakter</span>
                </button>
              );
            }
            return (
              <div key={row.id} className="flex min-h-28 flex-col rounded-2xl border border-border bg-bg/80 px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${CLASS_TONE[row.classId] ?? "#c9a15b"}` }}>
                <div className="flex items-center gap-3">
                  <ClassSigil id={row.classId} />
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-widest text-muted">YUVA {slot + 1}</p>
                    <p className="truncate text-lg text-fg">{row.name}</p>
                    <p className="text-sm text-gold">Sv. {row.level} · {className(row.classId)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={primary} disabled={!ready} onClick={() => play(row)}>
                    {ready ? "Giriş Yap" : "Dünya yerleşiyor"}
                  </button>
                  <button type="button" className={ghost} onClick={() => setDeleting(row)}>
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && rows !== null ? <p className="mt-3 text-sm text-hp">{error}</p> : null}
      {!needsPassword && creating == null && !deleting ? <ChangeDeletePassword /> : null}
    </section>
  );
}

function ChangeDeletePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4">
      <button type="button" className={ghost} onClick={() => setOpen((value) => !value)}>
        Silme şifresini değiştir
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-border bg-bg/60 p-3">
          <label className="block text-sm text-muted" htmlFor="old-del">
            Eski silme şifresi
          </label>
          <input id="old-del" type="password" value={current} className={field} onChange={(e) => setCurrent(e.target.value)} />
          <label className="mt-3 block text-sm text-muted" htmlFor="new-del">
            Yeni silme şifresi
          </label>
          <input id="new-del" type="password" value={next} className={field} onChange={(e) => setNext(e.target.value)} />
          <button
            type="button"
            className={`${primary} mt-3`}
            disabled={busy || current.length < 4 || next.trim().length < 4}
            onClick={() => {
              setBusy(true);
              setNote("");
              void changeDeletePassword({ data: { current, next } })
                .then((res) => {
                  if (!res.ok) {
                    setNote(res.reason === "bad-password" ? "Eski şifre yanlış." : res.reason === "length" ? "Yeni şifre en az 4 karakter." : "Şifre değişmedi.");
                    return;
                  }
                  setCurrent("");
                  setNext("");
                  setNote("Silme şifresi değişti.");
                })
                .catch(() => setNote("Şifre değişmedi."))
                .finally(() => setBusy(false));
            }}
          >
            Kaydet
          </button>
          {note ? <p className="mt-2 text-sm text-gold">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function leaveToCharacters() {
  const id = useSession.getState().activeId;
  const task = id ? saveCharacter({ data: { id, save: captureSave() } }) : Promise.resolve();
  void task.finally(() => {
    useSession.getState().leave();
    void import("@/game/hudStore").then(({ useHud }) => useHud.getState().setPlaying(false));
  });
}

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4">
      <div>
        <AuthScreens />
        <button type="button" className={`${ghost} mt-3`} onClick={() => void navigate({ to: "/" })}>
          Köye dön
        </button>
      </div>
    </main>
  );
}
