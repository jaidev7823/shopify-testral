// app/components/compare/CompareWorkspace.tsx

import { useState } from "react";
import SnapshotPane from "./SnapshotPane";
import PageActions from "./PageActions";

export default function CompareWorkspace({ selectedPage }: { selectedPage: any | null }) {
    const [diffImage, setDiffImage] = useState<string | null>(null);

    if (!selectedPage) {
        return (
            <div style={{ padding: "20px", textAlign: "center" }}>
                Select a page to view comparison
            </div>
        );
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateRows: "auto 1fr",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <PageActions
                selectedPage={selectedPage}
                onDiffGenerated={setDiffImage}
            />

            <div
                style={{
                    padding: "16px",
                    display: "grid",
                    gridTemplateColumns: diffImage ? "1fr 1fr 1fr" : "1fr 1fr",
                    gap: "16px",
                    height: "100%",
                    overflowY: "auto",
                }}
            >
                <SnapshotPane
                    title="Baseline"
                    images={selectedPage.images.baseline ? [selectedPage.images.baseline] : []}
                />

                <SnapshotPane
                    title="Current"
                    images={[selectedPage.images.current]}
                />

                {diffImage && (
                    <SnapshotPane
                        title="Diff"
                        images={[diffImage]}
                    />
                )}
            </div>
        </div>
    );
}
