import SnapshotPane from "./SnapshotPane";
import PageActions from "./PageActions";

export default function CompareWorkspace() {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateRows: "auto 1fr",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <PageActions />

            <div
                style={{
                    padding: "16px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    height: "100%",
                    overflowY: "auto",
                }}
            >
                <SnapshotPane title="Baseline" />
                <SnapshotPane title="Current" />
            </div>
        </div>
    );
}
