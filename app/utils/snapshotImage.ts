// app/utils/snapshotImage.ts
type SnapshotImageType = "baseline" | "current";

export function getSnapshotImageUrl({
    storeId,
    type,
    filename,
}: {
    storeId: string;
    type: SnapshotImageType;
    filename: string;
}) {
    return `/screenshots/store-${storeId}/${type}/${filename}`;
}
