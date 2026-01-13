export default function CompareHeader({ run, hasBaseline }: any) {
    return (
        <div
            style={{
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e5e7eb",
            }}
        >
            <strong>Snapshot Compare</strong>

            <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span>Run: {run.id}</span>
                <span
                    style={{
                        color: hasBaseline ? "green" : "red",
                        fontWeight: 500,
                    }}
                >
                    {hasBaseline ? "Baseline ready" : "No baseline"}
                </span>
            </div>
        </div>
    );
}
