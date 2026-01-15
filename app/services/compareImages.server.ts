import fs from "fs";
import path from "path";
// @ts-ignore
import sharp from "sharp";
import resemble from "resemblejs";

export interface ComparisonResult {
    mismatch: number;
    diffPath: string; // This should be the filesystem path only
    isSameDimensions: boolean;
}

export async function compareImages(
    baselinePath: string,
    currentPath: string,
    diffPath: string // This is the FILESYSTEM path where the file is written
): Promise<ComparisonResult> {
    // 1. Ensure files exist
    if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) {
        throw new Error("One or both images missing");
    }

    // 2. Load metadata and normalize dimensions if needed (basic crop to smaller)
    const meta1 = await sharp(baselinePath).metadata();
    const meta2 = await sharp(currentPath).metadata();

    const width = Math.min(meta1.width || 0, meta2.width || 0);
    const height = Math.min(meta1.height || 0, meta2.height || 0);

    if (width === 0 || height === 0) throw new Error("Invalid image dimensions");

    // Helper to normalize
    const normalize = async (p: string) => {
        return sharp(p)
            .extract({ left: 0, top: 0, width, height })
            .toBuffer();
    };

    const buf1 = await normalize(baselinePath);
    const buf2 = await normalize(currentPath);

    // 3. Diff with ResembleJS
    return new Promise((resolve, reject) => {
        resemble(buf1)
            .compareTo(buf2)
            .ignoreAntialiasing()
            .outputSettings({
                errorColor: {
                    red: 255,
                    green: 0,
                    blue: 255,
                },
                errorType: "movement",
                transparency: 0.3,
                largeImageThreshold: 1200,
                useCrossOrigin: false,
                outputDiff: true,
            } as any)
            .onComplete((data: any) => {
                if (data.getBuffer) {
                    // Ensure dir exists
                    const dir = path.dirname(diffPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    fs.writeFileSync(diffPath, data.getBuffer());

                    // Return the filesystem path that was written
                    resolve({
                        mismatch: Number(data.misMatchPercentage),
                        diffPath, // This is the filesystem path
                        isSameDimensions: data.isSameDimensions,
                    });
                } else {
                    reject(new Error("Failed to generate diff buffer"));
                }
            });
    });
}