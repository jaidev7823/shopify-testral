import { Card, Text, BlockStack } from "@shopify/polaris";
import { useEnv } from "~/hooks/useEnv";

export default function SnapshotPane({
  title,
  images,
}: {
  title: string;
  images: string[];
}) {
  const { PUBLIC_BASE_URL } = useEnv().ENV;

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="bodyMd" fontWeight="bold" as="h4">
          {title}
        </Text>

        <BlockStack gap="200">
          {images.map((image, index) => {
            const src = image.startsWith("http")
              ? image
              : `${PUBLIC_BASE_URL}${image}`;

            return (
              <div
                key={index}
                style={{
                  background: "var(--p-color-bg-surface-secondary)",
                  borderRadius: "var(--p-border-radius-200)",
                  overflow: "hidden",
                }}
              >
                <img
                  src={src}
                  alt={`${title}-${index}`}
                  style={{
                    width: "100%",
                    display: "block",
                  }}
                />
              </div>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
