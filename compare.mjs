import fs from "fs";
import sharp from "sharp";
import resemble from "resemblejs";

// load metadata
const meta1 = await sharp("img1.png").metadata();
const meta2 = await sharp("img2.png").metadata();

// normalize dimensions
const width = Math.min(meta1.width, meta2.width);
const height = Math.min(meta1.height, meta2.height);

// crop both images to same size
async function normalize(path) {
  return sharp(path)
    .extract({ left: 0, top: 0, width, height })
    .blur(0.6)
    .resize({
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.5),
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();
}


const img1 = await normalize("img1.png");
const img2 = await normalize("img2.png");

// diff
resemble(img1)
  .compareTo(img2)
  .ignoreAntialiasing()
  .ignoreLess()
  .scaleToSameSize()
  .outputSettings({
    errorType: "movement",
  })
  .onComplete((data) => {
    console.log("Mismatch %:", data.misMatchPercentage);
    console.log("Diff bounds:", data.diffBounds);

    fs.writeFileSync("diff.png", data.getBuffer());
  });
