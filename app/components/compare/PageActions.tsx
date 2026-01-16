// app/components/compare/PageActions.tsx

import { Button, InlineStack, Text, ButtonGroup, Banner, BlockStack } from "@shopify/polaris";
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
    const compareFetcher = useFetcher();
    const approvalFetcher = useFetcher();

    // Handle comparison response
    useEffect(() => {
        if (compareFetcher.state === "idle" && compareFetcher.data?.ok) {
            setIsComparing(false);
            onDiffGenerated(compareFetcher.data.result.diffPath);
        } else if (compareFetcher.state === "idle" && compareFetcher.data && !compareFetcher.data.ok) {
            setIsComparing(false);
            console.error("Comparison failed:", compareFetcher.data.error);
        }
    }, [compareFetcher.state, compareFetcher.data, onDiffGenerated]);

    const handleCompare = async () => {
        if (!selectedPage || !selectedPage.images.baseline) {
            return;
        }

        setIsComparing(true);

        compareFetcher.submit(
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

    const handleApprove = () => {
        if (!selectedPage?.comparison?.id) return;

        approvalFetcher.submit(
            {
                action: "approve",
                comparisonId: selectedPage.comparison.id,
            },
            {
                method: "post",
                action: ".",
            }
        );
    };

    const handleReject = () => {
        if (!selectedPage?.comparison?.id) return;

        approvalFetcher.submit(
            {
                action: "reject",
                comparisonId: selectedPage.comparison.id,
                rejectionReason: "Visual regression detected",
            },
            {
                method: "post",
                action: ".",
            }
        );
    };

    const approvalStatus = selectedPage?.comparison?.approvalStatus;
    const isApproved = approvalStatus === "APPROVED";
    const isRejected = approvalStatus === "REJECTED";
    const isAutoApproved = approvalStatus === "AUTO_APPROVED";
    const isPending = approvalStatus === "PENDING";

    return (
        <BlockStack gap="300">
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
                            variant="secondary"
                        >
                            Compare
                        </Button>
                        <Button
                            onClick={handleApprove}
                            loading={approvalFetcher.state === "submitting"}
                            disabled={!selectedPage?.comparison || isApproved || isAutoApproved}
                            variant="primary"
                            tone="success"
                        >
                            {isApproved ? "Approved ✓" : "Approve"}
                        </Button>
                        <Button
                            onClick={handleReject}
                            loading={approvalFetcher.state === "submitting"}
                            disabled={!selectedPage?.comparison || isRejected}
                            tone="critical"
                        >
                            {isRejected ? "Rejected ✗" : "Reject"}
                        </Button>
                    </ButtonGroup>
                </InlineStack>
            </div>

            {/* Status Banner */}
            {selectedPage?.comparison && (
                <div style={{ padding: "0 16px" }}>
                    {isApproved && (
                        <Banner tone="success">
                            This page has been approved
                        </Banner>
                    )}
                    {isRejected && (
                        <Banner tone="critical">
                            This page has been rejected as a visual regression
                        </Banner>
                    )}
                    {isAutoApproved && (
                        <Banner tone="info">
                            No visual changes detected - auto-approved
                        </Banner>
                    )}
                    {isPending && selectedPage.comparison.isDifferent && (
                        <Banner tone="warning">
                            Visual changes detected ({selectedPage.comparison.diffScore?.toFixed(2)}% difference) - awaiting review
                        </Banner>
                    )}
                </div>
            )}
        </BlockStack>
    );
}