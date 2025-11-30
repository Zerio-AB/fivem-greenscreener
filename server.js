/// <reference types="@citizenfx/server" />
/// <reference types="image-js" />

const imagejs = require("image-js");
const fs = require("fs");
const config = JSON.parse(LoadResourceFile(GetCurrentResourceName(), "config.json"));

const resName = GetCurrentResourceName();
const mainSavePath = `resources/${resName}/images`;

try {
	if (!fs.existsSync(mainSavePath)) {
		fs.mkdirSync(mainSavePath);
	}

	onNet("takeScreenshot", async (filename, type) => {
		const savePath = `${mainSavePath}/${type}`;
		if (!fs.existsSync(savePath)) {
			fs.mkdirSync(savePath);
		}

		const fullFilePath = savePath + "/" + filename + ".png";

		// Check if file exists and overwrite is disabled
		if (!config.overwriteExistingImages && fs.existsSync(fullFilePath)) {
			if (config.debug) {
				console.log(
					`[GREENSCREENER] Skipping existing file: ${filename}.png (overwriteExistingImages = false)`
				);
			}
			return;
		}

		if (config.debug) {
			console.log(`[GREENSCREENER] Processing screenshot: ${filename}.png`);
		}

		exports["screenshot-basic"].requestClientScreenshot(
			source,
			{
				fileName: fullFilePath,
				encoding: "png",
				quality: 1.0,
			},
			async (err, fileName) => {
				let image = await imagejs.Image.load(fileName);

				// First, apply green screen removal to make green pixels transparent
				for (let x = 0; x < image.width; x++) {
					for (let y = 0; y < image.height; y++) {
						const pixelArr = image.getPixelXY(x, y);
						const r = pixelArr[0];
						const g = pixelArr[1];
						const b = pixelArr[2];

						if (g > r + b) {
							image.setPixelXY(x, y, [255, 255, 255, 0]);
						}
					}
				}

				// Find the bounds of non-transparent content
				let minX = image.width;
				let maxX = -1;
				let minY = image.height;
				let maxY = -1;

				for (let x = 0; x < image.width; x++) {
					for (let y = 0; y < image.height; y++) {
						const pixelArr = image.getPixelXY(x, y);
						const alpha = pixelArr[3];

						// If pixel is not transparent
						if (alpha > 0) {
							minX = Math.min(minX, x);
							maxX = Math.max(maxX, x);
							minY = Math.min(minY, y);
							maxY = Math.max(maxY, y);
						}
					}
				}

				// If we found content, crop to the content bounds
				if (maxX >= minX && maxY >= minY) {
					const contentWidth = maxX - minX + 1;
					const contentHeight = maxY - minY + 1;

					const croppedImage = image.crop({
						x: minX,
						y: minY,
						width: contentWidth,
						height: contentHeight,
					});

					image.data = croppedImage.data;
					image.width = croppedImage.width;
					image.height = croppedImage.height;
				}

				image.save(fileName);
			}
		);
	});
} catch (error) {
	console.error(error.message);
}
