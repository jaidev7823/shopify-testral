// app/components/compare/CompareWorkspace.tsx

import { useState, useEffect } from "react";
import SnapshotPane from "./SnapshotPane";
import PageActions from "./PageActions";

export default function CompareWorkspace({
    selectedPage,
    storeId,
    baseRunId,
    targetRunId,
}: {
    selectedPage: any | null;
    storeId: string;
    baseRunId: string;
    targetRunId: string;
}) {
    const [diffImage, setDiffImage] = useState<string | null>(null);
    const [hasDiffImage, setHasDiffImage] = useState<boolean>(false);

    // Fetch comparison data when page changes
    useEffect(() => {
        if (!selectedPage) {
            setDiffImage(null);
            setHasDiffImage(false);
            return;
        }

        // Fetch the latest comparison from the database
        async function fetchComparison() {
            try {
                const response = await fetch(`/api/comparison?pageId=${selectedPage.id}`);
                const data = await response.json();

                if (data.comparison && data.comparison.diffImagePath) {
                    setDiffImage(data.comparison.diffImagePath);
                    setHasDiffImage(true);
                } else {
                    setDiffImage(null);
                    setHasDiffImage(false);
                }
            } catch (error) {
                console.error("Failed to fetch comparison:", error);
                setDiffImage(null);
                setHasDiffImage(false);
            }
        }

        fetchComparison();
    }, [selectedPage]);

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
                storeId={storeId}
                baseRunId={baseRunId}
                targetRunId={targetRunId}
                onDiffGenerated={(path) => {
                    setDiffImage(path);
                    setHasDiffImage(!!path);
                }}
            />

            <div
                style={{
                    padding: "16px",
                    display: "grid",
                    gridTemplateColumns: hasDiffImage ? "1fr 1fr 1fr" : "1fr 1fr",
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

                {hasDiffImage && diffImage && (
                    <SnapshotPane
                        title="Diff"
                        images={[diffImage]}
                    />
                )}
            </div>
        </div>
    );
}