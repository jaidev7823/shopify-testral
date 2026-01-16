// app/components/compare/PageList.tsx

import { Box, BlockStack, Text, InlineStack, Badge, Card } from "@shopify/polaris";

export default function PageList({
    pages,
    selectedPageId,
    onSelect
}: {
    pages: any[],
    selectedPageId: string | null,
    onSelect: (id: string) => void
}) {
    const getStatusBadge = (page: any) => {
        if (!page.comparison) {
            return <Badge size="small" tone="attention">No Baseline</Badge>;
        }

        const { approvalStatus, isDifferent } = page.comparison;

        if (approvalStatus === "APPROVED") {
            return <Badge size="small" tone="success">Approved</Badge>;
        }
        if (approvalStatus === "REJECTED") {
            return <Badge size="small" tone="critical">Rejected</Badge>;
        }
        if (approvalStatus === "AUTO_APPROVED") {
            return <Badge size="small" tone="info">Match</Badge>;
        }
        if (isDifferent) {
            return <Badge size="small" tone="warning">Pending</Badge>;
        }
        return <Badge size="small" tone="success">Match</Badge>;
    };

    return (
        <div
            style={{
                borderRight: "1px solid var(--p-color-border-secondary)",
                overflowY: "auto",
                height: "100%",
                background: "var(--p-color-bg-surface-secondary)",
            }}
        >
            <Box padding="200">
                <BlockStack gap="100">
                    {pages.map((page) => {
                        const isDifferent = page.comparison?.isDifferent;
                        const isSelected = selectedPageId === page.id;
                        return (
                            <div
                                key={page.id}
                                style={{
                                    cursor: "pointer",
                                    opacity: isSelected ? 1 : 0.7
                                }}
                                onClick={() => onSelect(page.id)}
                            >
                                <div style={{
                                    border: isSelected ? "2px solid var(--p-color-border-focus)" : "2px solid transparent",
                                    borderRadius: "var(--p-border-radius-200)"
                                }}>
                                    <Card>
                                        <BlockStack gap="100">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingSm" as="h6">
                                                    {page.pageName}
                                                </Text>
                                                {getStatusBadge(page)}
                                            </InlineStack>
                                            <Text variant="bodySm" tone="subdued" as="p" truncate>
                                                {page.pageUrl}
                                            </Text>
                                        </BlockStack>
                                    </Card>
                                </div>
                            </div>
                        );
                    })}
                </BlockStack>
            </Box>
        </div>
    );
}
