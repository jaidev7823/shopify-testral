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
                        const isSelected = selectedPageId === page.id;
                        return (
                            <div
                                key={page.id}
                                style={{
                                    cursor: "pointer",
                                    // Basic visual feedback for selection
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
                                                {/* Placeholder status */}
                                                <Badge size="small" tone="success">
                                                    Match
                                                </Badge>
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
