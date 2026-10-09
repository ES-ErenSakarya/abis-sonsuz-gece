import { useEffect } from "react";
import { useP2PRoom } from "@/lib/multiplayer";
import { clearRemotes, parseBody, presence, retainRemotes, setLink, upsertRemote } from "@/game/online";
import { bindChatSend, receiveChat } from "@/game/chat";
import { bindField, ingestField, setRoster } from "@/game/field";
import { bindDuelSend, receivePacket } from "@/game/target";

export function NetLive({ nick }: { nick: string }) {
  const p2p = useP2PRoom({ room: "abis-gece", name: (nick || "Gezgin").slice(0, 24) });

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
