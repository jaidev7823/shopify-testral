import { InlineStack, Text, Badge } from "@shopify/polaris";

export default function CompareHeader({ run, hasBaseline }: any) {
    return (
        <div
            style={{
                padding: "16px",
                borderBottom: "1px solid var(--p-color-border-secondary)",
                background: "var(--p-color-bg-surface)",
            }}
        >
            <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingLg" as="h2">
                    Snapshot Compare
                </Text>

                <InlineStack gap="300" blockAlign="center">
                    <Text as="span" tone="subdued">
                        Run: {run.id}
                    </Text>
                    <Badge tone={hasBaseline ? "success" : "critical"}>
                        {hasBaseline ? "Baseline ready" : "No baseline"}
                    </Badge>
                </InlineStack>
            </InlineStack>
        </div>
    );
}
