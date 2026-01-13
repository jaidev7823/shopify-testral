export default function PageList({ pages }: { pages: any[] }) {
    return (
        <div
            style={{
                borderRight: "1px solid #e5e7eb",
                overflowY: "auto",
            }}
        >
            {pages.map((page) => (
                <div
                    key={page.id}
                    style={{
                        padding: "12px 16px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                    }}
                >
                    <div style={{ fontWeight: 500 }}>{page.pageName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        {page.pageUrl}
                    </div>
                </div>
            ))}
        </div>
    );
}
