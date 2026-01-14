// app/components/compare/CompareHeader.tsx
import { InlineStack, Text, Badge, Button } from "@shopify/polaris";
import { useFetcher } from "react-router";

export default function CompareHeader({ run, hasBaseline }: any) {
    const fetcher = useFetcher();

    const isRunning = run.compareStatus === "IN_PROGRESS";

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
                    <Badge tone={hasBaseline ? "success" : "critical"}>
                        {hasBaseline ? "Baseline ready" : "No baseline"}
                    </Badge>

                    <fetcher.Form method="post">
                        <Button
                            submit
                            disabled={!hasBaseline || isRunning}
                            loading={isRunning}
                        >
                            Compare
                        </Button>
                    </fetcher.Form>
                </InlineStack>
            </InlineStack>
        </div>
    );
}
