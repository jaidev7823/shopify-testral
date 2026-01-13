export default function SnapshotPane({ title }: { title: string }) {
    return (
        <div
            style={{
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: 500,
                }}
            >
                {title}
            </div>

            <div
                style={{
                    flex: 1,
                    background: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                }}
            >
                Image goes here
            </div>
        </div>
    );
}
