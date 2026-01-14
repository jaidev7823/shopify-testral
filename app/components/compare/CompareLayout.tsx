import { useState, useEffect } from "react";
import CompareHeader from "./CompareHeader";
import PageList from "./PageList";
import CompareWorkspace from "./CompareWorkspace";

export default function CompareLayout({ pages, run, hasBaseline }: any) {
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

    // Default to first page
    useEffect(() => {
        if (pages.length > 0 && !selectedPageId) {
            setSelectedPageId(pages[0].id);
        }
    }, [pages, selectedPageId]);

    const selectedPage = pages.find((p: any) => p.id === selectedPageId) || null;
    return (
        <div
            style={{
                height: "100vh",
                display: "grid",
                gridTemplateRows: "auto 1fr",
                background: "var(--p-color-bg-surface)",
            }}
        >
            {/* Header */}
            <CompareHeader run={run} hasBaseline={hasBaseline} />

            {/* Body */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "280px 1fr",
                    overflow: "hidden",
                }}
            >
                <PageList
                    pages={pages}
                    selectedPageId={selectedPageId}
                    onSelect={setSelectedPageId}
                />
                <CompareWorkspace selectedPage={selectedPage} />
            </div>
        </div>
    );
}
