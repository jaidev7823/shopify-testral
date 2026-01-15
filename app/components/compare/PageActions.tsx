// app/components/compare/PageActions.tsx

import { Button, InlineStack, Text, ButtonGroup } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { useFetcher } from "react-router";

export default function PageActions({
    selectedPage,
    storeId,
    baseRunId,
    targetRunId,
    onDiffGenerated
}: {
    selectedPage: any | null;
    storeId: string;
    baseRunId: string;
    targetRunId: string;
    onDiffGenerated: (diffPath: string | null) => void;
}) {
    const [isComparing, setIsComparing] = useState(false);
    const fetcher = useFetcher();

    // Handle fetcher response
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.ok) {
            setIsComparing(false);
            onDiffGenerated(fetcher.data.result.diffPath);
        } else if (fetcher.state === "idle" && fetcher.data && !fetcher.data.ok) {
            setIsComparing(false);
            console.error("Comparison failed:", fetcher.data.error);
        }
    }, [fetcher.state, fetcher.data, onDiffGenerated]);

    const handleCompare = async () => {
        if (!selectedPage || !selectedPage.images.baseline) {
            return;
        }

        setIsComparing(true);

        // Send comparison request
        fetcher.submit(
            {
                action: "compare",
                pageId: selectedPage.id,
                pageName: selectedPage.pageName,
                baselineImage: selectedPage.images.baseline,
                currentImage: selectedPage.images.current,
                storeId,
                baseRunId,
                targetRunId,
            },
            {
                method: "post",
                action: ".",
            }
        );
    };

    return (
        <div
            style={{
                padding: "16px",
                borderBottom: "1px solid var(--p-color-border-secondary)",
            }}
        >
            <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                    {selectedPage?.pageName || "Select a page"}
                </Text>

                <ButtonGroup>
                    <Button
                        onClick={handleCompare}
                        loading={isComparing}
                        disabled={!selectedPage?.images.baseline}
                        variant="primary"
                    >
                        Compare
                    </Button>
                    <Button>
                        Approve
                    </Button>
                </ButtonGroup>
            </InlineStack>
        </div>
    );
}