import { useEffect, useRef } from "react";
import { useP2PRoom } from "@/lib/multiplayer";
import { clearRemotes, parseBody, presence, retainRemotes, setLink, upsertRemote } from "@/game/online";
import { bindChatSend, receiveChat, systemSay } from "@/game/chat";
import { bindField, ingestField, setRoster } from "@/game/field";
import { bindDuelSend, receivePacket } from "@/game/target";
import { useRpg } from "@/game/rpg";
import { signOut } from "@/lib/auth/client";

const KICK_TEXT = "Hesabınıza başka bir bilgisayar veya tarayıcı tarafından giriş yapıldı çıkış yapılıyor.";

function wireName(nick: string, account?: string) {
  const shown = (nick || "Gezgin").replace(/\|/g, "").slice(0, 24);
  if (!account || account === "dev-user") return shown.slice(0, 24);
  const id = account.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 28);
  if (!id) return shown.slice(0, 24);
  return `u:${id}|${shown}`.slice(0, 64);
}

export function NetLive({ nick, account }: { nick: string; account?: string }) {
  const name = wireName(nick, account);
  const kicked = useRef(false);
  const p2p = useP2PRoom({
    room: "abis-gece",
    name,
    onKicked: () => {
      if (kicked.current) return;
      kicked.current = true;
      systemSay(KICK_TEXT);
      useRpg.setState({ toast: KICK_TEXT });
      window.setTimeout(() => {
        void signOut("/");
      }, 1200);
    },
  });

  useEffect(() => {
    setLink(p2p.joined ? "live" : "wait", p2p.peers.length);
    retainRemotes(new Set(p2p.peers.map((peer) => peer.id)));
    setRoster(p2p.selfId, p2p.peers.map((peer) => peer.id));
  }, [p2p.joined, p2p.peers, p2p.selfId]);

  useEffect(
    () =>
      p2p.onMessage((from, data) => {
        if (data && typeof data === "object" && (data as { kind?: string }).kind === "body") {
          const body = parseBody(data);
          if (body) upsertRemote(from, body);
          return;
        }
        if (ingestField(from, data)) return;
        receivePacket(from, data);
        receiveChat(from, data);
      }),
    [p2p.onMessage],
  );

  useEffect(() => bindDuelSend((peerId, data) => p2p.send(data, peerId)), [p2p.send]);
  useEffect(
    () =>
      bindField((data, peerId) => {
        if (peerId) p2p.send(data, peerId);
        else p2p.broadcast(data);
      }),
    [p2p.send, p2p.broadcast],
  );
  useEffect(
    () =>
      bindChatSend((peerId, data) => {
        if (peerId) p2p.send(data, peerId);
        else p2p.broadcast(data);
      }),
    [p2p.send, p2p.broadcast],
  );

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= 80) {
        last = now;
        p2p.broadcast({ kind: "body", ...presence });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [p2p.broadcast]);

  useEffect(
    () => () => {
      setLink("off", 0);
      clearRemotes();
    },
    [],
  );

  return null;
}
