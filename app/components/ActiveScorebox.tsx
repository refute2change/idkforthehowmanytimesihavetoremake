interface ActiveScoreBoxProps {
  score: number;
  highlightActive: boolean;
  isStarActive?: boolean;
}

export function ActiveScoreBox({ score, highlightActive, isStarActive = false }: ActiveScoreBoxProps) {
  const styles = {
    box: {
      width: "150px",
      height: "125px",
      borderRadius: "12px",
      backgroundColor: highlightActive ? "#141414" : "transparent",
      border: highlightActive
        ? (isStarActive ? "2px solid #ffb703" : "1px solid #4CAF50")
        : "1px dashed #2b2b2b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: (highlightActive && isStarActive) ? "0 0 15px rgba(255, 183, 3, 0.25)" : "none",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
    },
    value: {
      color: isStarActive ? "#ffb703" : "#4CAF50",
      fontSize: "4.5rem",
      fontWeight: "bold",
      lineHeight: "1"
    }
  };

  return (
    <div style={styles.box}>
      {highlightActive && <div style={styles.value}>{score}</div>}
    </div>
  );
}