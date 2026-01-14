// app/components/compare/PageActions.tsx

import { Button, InlineStack, Text, ButtonGroup } from "@shopify/polaris";

export default function PageActions() {
    return (
        <div
            style={{
                padding: "16px",
                borderBottom: "1px solid var(--p-color-border-secondary)",
            }}
        >
            <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                    Homepage
                </Text>

                <ButtonGroup>
                    <Button>Diff</Button>
                    <Button>Overlay</Button>
                    <Button>Toggle Grid</Button>
                </ButtonGroup>
            </InlineStack>
        </div>
    );
}
