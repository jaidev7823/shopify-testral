import CompareHeader from "./CompareHeader";
import PageList from "./PageList";
import CompareWorkspace from "./CompareWorkspace";

export default function CompareLayout({ run, hasBaseline }: any) {
    return (
        <div
            style={{
                height: "100vh",
                display: "grid",
                gridTemplateRows: "64px 1fr",
            }}
        >
            {/* Header */}
            <CompareHeader run={run} hasBaseline={hasBaseline} />

            {/* Body */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "280px 1fr",
                    borderTop: "1px solid #e5e7eb",
                }}
            >
                <PageList pages={run.pages} />
                <CompareWorkspace />
            </div>
        </div>
    );
}
