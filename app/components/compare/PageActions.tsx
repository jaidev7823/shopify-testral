export default function PageActions() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}
        >
            <strong>Homepage</strong>

            <div style={{ display: "flex", gap: 8 }}>
                <button>Diff</button>
                <button>Overlay</button>
                <button>Toggle Grid</button>
            </div>
        </div>
    );
}
