import { Card, Text, BlockStack, Box } from "@shopify/polaris";

export default function SnapshotPane({ title }: { title: string }) {
    // Using a custom container for the image area since Card doesn't have a direct image slot like this
    return (
        <Card>
            <BlockStack gap="400">
                <Text variant="bodyMd" fontWeight="bold" as="h4">
                    {title}
                </Text>
                <div
                    style={{
                        height: "400px",
                        background: "var(--p-color-bg-surface-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--p-border-radius-200)",
                        color: "var(--p-color-text-subdued)",
                    }}
                >
                    Image goes here
                </div>
            </BlockStack>
        </Card>
    );
}
