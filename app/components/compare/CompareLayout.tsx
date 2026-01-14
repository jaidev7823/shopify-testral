// app/components/compare/CompareLayout.tsx
import { useState, useEffect } from "react";
import CompareHeader from "./CompareHeader";
import PageList from "./PageList";
import CompareWorkspace from "./CompareWorkspace";

export default function CompareLayout({ pages, run, hasBaseline }: any) {
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const sortedPages = [...pages].sort((a, b) => {
        const aDiff = a.comparison?.isDifferent ? 1 : 0;
        const bDiff = b.comparison?.isDifferent ? 1 : 0;
        return bDiff - aDiff;
    });

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
                    pages={sortedPages}
                    selectedPageId={selectedPageId}
                    onSelect={setSelectedPageId}
                />

                <CompareWorkspace selectedPage={selectedPage} />
            </div>
        </div>
    );
}
