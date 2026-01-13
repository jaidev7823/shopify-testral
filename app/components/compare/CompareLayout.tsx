import CompareHeader from "./CompareHeader";
import PageList from "./PageList";
import CompareWorkspace from "./CompareWorkspace";

export default function CompareLayout({ run, hasBaseline }: any) {
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
                <PageList pages={run.pages} />
                <CompareWorkspace />
            </div>
        </div>
    );
}
