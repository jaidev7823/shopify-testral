import SnapshotPane from "./SnapshotPane";
import PageActions from "./PageActions";

export default function CompareWorkspace() {
    return (
        <div
            style={{
                padding: 16,
                display: "grid",
                gridTemplateRows: "48px 1fr",
                gap: 12,
            }}
        >
            <PageActions />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    height: "100%",
                }}
            >
                <SnapshotPane title="Baseline" />
                <SnapshotPane title="Current" />
            </div>
        </div>
    );
}
