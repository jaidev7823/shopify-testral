// app/components/compare/PageActions.tsx

import { Button, InlineStack, Text, ButtonGroup, Banner } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { useFetcher } from "react-router";

export default function PageActions({
    selectedPage,
    onDiffGenerated
}: {
    selectedPage: any | null;
    onDiffGenerated: (diffPath: string | null) => void;
}) {
    const [isComparing, setIsComparing] = useState(false);
    const fetcher = useFetcher();

    // Handle fetcher response
    useEffect(() => {
        if (fetcher.data && fetcher.state === "idle") {
            setIsComparing(false);

            if (fetcher.data.ok && fetcher.data.result?.diffPath) {
                onDiffGenerated(fetcher.data.result.diffPath);
            } else if (!fetcher.data.ok) {
                console.error("Comparison failed:", fetcher.data.error);
            }
        }
    }, [fetcher.data, fetcher.state, onDiffGenerated]);

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
            },
            { method: "post" }
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
                    {/* <Button>Diff</Button> */}
                    {/* <Button>Overlay</Button> */}
                    {/* <Button>Toggle Grid</Button> */}
                </ButtonGroup>
            </InlineStack>
        </div>
    );
}
