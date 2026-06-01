// app/components/GameHeader.tsx
import { type ReactNode } from "react";
import { useSocket } from "./SocketContext";

interface GameHeaderProps {
  title: string;
  subTitle?: string;
  children?: ReactNode; // ADD THIS: Allows passing action triggers into the header layout row
}

export function GameHeader({ title, subTitle, children }: GameHeaderProps) {
  const { currentRoom, disconnectSocket } = useSocket();

  const styles = {
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    leftCluster: { display: "flex", flexDirection: "column" as const },
    roomDisplay: { margin: "4px 0 0", color: "#888", fontSize: "0.95rem" },
    roomBadge: { color: "#4CAF50", fontFamily: "monospace", fontWeight: "bold" },
    rightCluster: { display: "flex", gap: "12px", alignItems: "center" },
    leaveBtn: { backgroundColor: "#f44336", color: "white", border: "none", padding: "10px 14px", borderRadius: "4px", cursor: "pointer", fontWeight: 500 }
  };

  return (
    <>
      <div style={styles.headerRow}>
        <div style={styles.leftCluster}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <p style={styles.roomDisplay}>
            Room: <span style={styles.roomBadge}>{currentRoom || "Offline"}</span>
            {subTitle && <span> • {subTitle}</span>}
          </p>
        </div>
        <div style={styles.rightCluster}>
          {children} {/* Render conditional panel triggers here */}
          <button onClick={disconnectSocket} style={styles.leaveBtn}>
            Leave Room
          </button>
        </div>
      </div>
      <hr style={{ borderColor: "#333", margin: "20px 0" }} />
    </>
  );
}