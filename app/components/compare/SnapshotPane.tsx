// app/components/compare/SnapshotPane.tsx

import { Card, Text, BlockStack } from "@shopify/polaris";

export default function SnapshotPane({
    title,
    images,
}: {
    title: string;
    images: string[];
}) {
    return (
        <Card>
            <BlockStack gap="400">
                <Text variant="bodyMd" fontWeight="bold" as="h4">
                    {title}
                </Text>

                <BlockStack gap="200">
                    {images.map((image, index) => (
                        <div
                            key={index}
                            style={{
                                background: "var(--p-color-bg-surface-secondary)",
                                borderRadius: "var(--p-border-radius-200)",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src={image}
                                alt={`${title}-${index}`}
                                style={{
                                    width: "100%",
                                    display: "block",
                                }}
                            />
                        </div>
                    ))}
                </BlockStack>
            </BlockStack>
        </Card>
    );
}
