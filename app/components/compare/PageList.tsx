import { Box, BlockStack, Text, InlineStack, Badge, Card } from "@shopify/polaris";

export default function PageList({ pages }: { pages: any[] }) {
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
                    {pages.map((page) => (
                        <div
                            key={page.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => console.log(page.id)}
                        >
                            <Card>
                                <BlockStack gap="100">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingSm" as="h6">
                                            {page.pageName}
                                        </Text>
                                        {/* Placeholder status - normally this would come from the page data */}
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
                    ))}
                </BlockStack>
            </Box>
        </div>
    );
}
