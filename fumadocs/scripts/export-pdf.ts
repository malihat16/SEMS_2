// ////////////////////////////////////////////////////////////

// Script to export all documentation pages as PDFs

// Bun Usage:

// 1. Start the local development server
// cd fumadocs; bun run dev

// 2. Run the PDF export script
// cd fumadocs; bun run ./scripts/export-pdf.ts

// ////////////////////////////////////////////////////////////

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";

// ////////////////////////////////////////////////////////////
// CONFIGURATION CONSTANTS
// ////////////////////////////////////////////////////////////

// Processing mode
const ENABLE_PARALLEL_MODE = true; // Set to true to process PDFs in parallel
const BATCH_SIZE: number = 4; // Number of PDFs to process in each batch (0 = process all at once)

// Logging configuration
const LOG_PROGRESS = true; // Log progress messages (e.g., "Processing 1/10: /docs/page")
const LOG_SUCCESS = true; // Log successful PDF generation messages
const LOG_WARNINGS = true; // Log warning messages (e.g., timeouts, image load failures)
const LOG_ERRORS = true; // Log error messages
const LOG_IMAGE_STATUS = false; // Log detailed image loading status
const LOG_BATCH_INFO = true; // Log batch processing information
const LOG_DELAYS = false; // Log delay/waiting messages

// Output configuration
const outDir = "pdfs"; // Output directory for PDFs

// Timeouts (in milliseconds)
const PAGE_LOAD_TIMEOUT = 60000; // 1 minute timeout for page load
const IMAGE_LOAD_TIMEOUT = 90000; // 90 second timeout for all images to load
const CONTENT_RENDER_DELAY = 5000; // Initial delay for content rendering
const IMAGE_FORCE_RELOAD_DELAY = 100; // Delay between image src reset and reload
const POST_IMAGE_RELOAD_DELAY = 5000; // Delay after forcing image reload
const FINAL_RENDER_DELAY = 3000; // Final delay before PDF generation
const LAZY_LOAD_SCROLL_DELAY = 300; // Delay between scroll steps for lazy loading
const BATCH_DELAY = 5000; // Delay between processing batches
const SEQUENTIAL_PAGE_DELAY = 2000; // Delay between pages in sequential mode
const DEPLOYMENT_MANUAL_DELAY = 10000; // Extra delay after processing deployment manual
const IMAGE_REQUEST_DELAY = 100; // Delay for Next.js image optimization requests

// Retry configuration
const MAX_IMAGE_LOAD_RETRIES = 3; // Maximum attempts to load images

// Viewport configuration
const VIEWPORT_WIDTH = 2480; // A4 width at 300 DPI
const VIEWPORT_HEIGHT = 3500; // A4 height at 300 DPI
const DEVICE_SCALE_FACTOR = 2; // Retina/HiDPI display scale

// PDF configuration
const PDF_WIDTH = 950;

// Files that need special handling (processed separately before others)
const PRIORITY_FILES = ["/deployment-manual"];

// ////////////////////////////////////////////////////////////

const browser = await puppeteer.launch({
  protocolTimeout: 1000000,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
});

// Recursively find all MDX files
async function findMdxFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findMdxFiles(fullPath);
      } else if (entry.name.endsWith(".mdx")) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

// Automatically discover all MDX files in the content directory
const contentDir = path.join(process.cwd(), "content", "docs");
const mdxFiles = await findMdxFiles(contentDir);

// Convert file paths to URLs and preserve file structure
const urlsWithPaths = mdxFiles.map((file: string) => {
  // Get relative path from content/docs directory
  const relativePath = path.relative(contentDir, file);
  // Remove .mdx extension and convert to URL path
  const urlPath = relativePath.replace(/\.mdx$/, "").replace(/\\/g, "/");
  return {
    url: `/docs/${urlPath}`,
    filePath: relativePath.replace(/\.mdx$/, ".pdf"),
  };
});

// Separate priority files from other pages
const priorityPages = urlsWithPaths.filter((item) =>
  PRIORITY_FILES.some((priorityFile) => item.url.includes(priorityFile))
);
const regularPages = urlsWithPaths.filter(
  (item) =>
    !PRIORITY_FILES.some((priorityFile) => item.url.includes(priorityFile))
);

async function exportPdf(pathname: string, pdfPath: string) {
  const page = await browser.newPage();

  // Set higher device scale factor for better image resolution
  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });

  // Enable request interception to add delays for image requests
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    // Add small delay for Next.js image optimization requests
    if (request.url().includes("/_next/image")) {
      setTimeout(() => {
        request.continue();
      }, IMAGE_REQUEST_DELAY);
    } else {
      request.continue();
    }
  });

  try {
    await page.goto("http://localhost:3000" + pathname, {
      waitUntil: "domcontentloaded", // Changed from networkidle0 for faster loading
      timeout: PAGE_LOAD_TIMEOUT,
    });
  } catch (error: any) {
    // If timeout, try to continue anyway - page might have loaded enough
    if (error.message && error.message.includes("timeout")) {
      if (LOG_WARNINGS) {
        console.warn(
          `  Page load timeout for ${pathname}, attempting to continue...`
        );
      }
    } else {
      throw error;
    }
  }

  // Simple wait for content to render
  await new Promise((resolve) => setTimeout(resolve, CONTENT_RENDER_DELAY));

  // Inject CSS to hide navigation header for PDF export
  await page.addStyleTag({
    content: `
      @media print {
        nav, header, [role="navigation"], [role="banner"] {
          display: none !important;
        }
      }
    `,
  });

  // Hide navigation elements to prevent them from blocking content
  await page.evaluate(() => {
    // Hide common navigation selectors
    const selectors = [
      "nav",
      "header",
      '[role="navigation"]',
      '[role="banner"]',
      ".navbar",
      ".nav-menu",
      ".navigation",
      ".header",
      ".top-nav",
      ".site-header",
    ];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
    });
  });

  // Scroll through the page to trigger lazy-loaded images
  await page.evaluate(async (scrollDelay) => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;

    // Scroll in increments to trigger lazy loading
    for (let y = 0; y < scrollHeight; y += viewportHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, scrollDelay));
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  }, LAZY_LOAD_SCROLL_DELAY);

  // Force reload all images with retries
  await page.evaluate((forceReloadDelay) => {
    const images = Array.from(document.images);
    images.forEach((img) => {
      // Store original src
      const originalSrc = img.src;
      // Force reload by setting src to empty and back
      img.src = "";
      setTimeout(() => {
        img.src = originalSrc;
      }, forceReloadDelay);
    });
  }, IMAGE_FORCE_RELOAD_DELAY);

  // Give images time to start loading after reload
  await new Promise((resolve) => setTimeout(resolve, POST_IMAGE_RELOAD_DELAY));

  // Wait for all images to fully load with multiple attempts
  let imagesLoaded = false;
  for (let attempt = 1; attempt <= MAX_IMAGE_LOAD_RETRIES; attempt++) {
    try {
      await page.waitForFunction(
        () => {
          const images = Array.from(document.images);
          console.log(`Found ${images.length} images`);
          const loadedImages = images.filter(
            (img) => img.complete && img.naturalHeight !== 0
          );
          console.log(`${loadedImages.length} images loaded`);
          return images.every((img) => img.complete && img.naturalHeight !== 0);
        },
        { timeout: IMAGE_LOAD_TIMEOUT }
      );
      if (LOG_IMAGE_STATUS) {
        console.log(`  All images loaded successfully for ${pathname}`);
      }
      imagesLoaded = true;
      break;
    } catch (error) {
      if (attempt < MAX_IMAGE_LOAD_RETRIES) {
        if (LOG_WARNINGS) {
          console.warn(`  Attempt ${attempt} failed, retrying...`);
        }
        // Force reload images again
        await page.evaluate((forceReloadDelay) => {
          const images = Array.from(document.images);
          images.forEach((img) => {
            const originalSrc = img.src;
            img.src = "";
            setTimeout(() => {
              img.src = originalSrc;
            }, forceReloadDelay);
          });
        }, IMAGE_FORCE_RELOAD_DELAY);
        await new Promise((resolve) =>
          setTimeout(resolve, POST_IMAGE_RELOAD_DELAY)
        );
      }
    }
  }

  if (!imagesLoaded) {
    // If images still didn't load in time, log details and continue anyway
    const imageStatus = await page.evaluate(() => {
      const images = Array.from(document.images);
      const failed = images.filter(
        (img) => !img.complete || img.naturalHeight === 0
      );
      return {
        total: images.length,
        loaded: images.length - failed.length,
        failed: failed.map((img) => img.src),
      };
    });
    if (LOG_WARNINGS) {
      console.warn(
        `  Some images may not have loaded for ${pathname}: ${imageStatus.loaded}/${imageStatus.total} loaded`
      );
    }
    if (imageStatus.failed.length > 0 && LOG_IMAGE_STATUS) {
      console.warn(`  Failed images: ${imageStatus.failed.join(", ")}`);
    }
  }

  // Additional wait to ensure rendering is complete
  await new Promise((resolve) => setTimeout(resolve, FINAL_RENDER_DELAY));

  // Create directory structure for the PDF
  const pdfFullPath = path.join(outDir, pdfPath);
  const pdfDir = path.dirname(pdfFullPath);
  await fs.mkdir(pdfDir, { recursive: true });

  await page.pdf({
    path: pdfFullPath,
    width: PDF_WIDTH,
    printBackground: true,
    preferCSSPageSize: false,
  });

  if (LOG_SUCCESS) {
    console.log(`PDF generated successfully for ${pathname}`);
  }
  await page.close();
}

await fs.mkdir(outDir, { recursive: true });

if (LOG_PROGRESS) {
  console.log(`Starting PDF export for ${urlsWithPaths.length} pages...`);
  console.log(
    `Parallel mode: ${ENABLE_PARALLEL_MODE ? "enabled" : "disabled"}`
  );
  console.log(`Batch size: ${BATCH_SIZE === 0 ? "all at once" : BATCH_SIZE}\n`);
}

// Process priority files first (separately due to special requirements)
if (priorityPages.length > 0) {
  if (LOG_BATCH_INFO) {
    console.log(
      `Processing ${priorityPages.length} priority file(s) separately...\n`
    );
  }
  for (const priorityPage of priorityPages) {
    try {
      await exportPdf(priorityPage.url, priorityPage.filePath);
      if (LOG_DELAYS) {
        console.log(
          `\nPriority file completed. Waiting before processing other pages...`
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, DEPLOYMENT_MANUAL_DELAY)
      );
    } catch (error) {
      if (LOG_ERRORS) {
        console.error(
          `Failed to export priority file ${priorityPage.url}:`,
          error
        );
      }
    }
  }
  if (LOG_BATCH_INFO) {
    console.log(`\n`);
  }
}

if (ENABLE_PARALLEL_MODE) {
  // Process PDFs in parallel with batching
  if (BATCH_SIZE === 0) {
    // Process all PDFs at once
    await Promise.allSettled(
      regularPages.map(async ({ url, filePath }, i) => {
        if (LOG_PROGRESS) {
          console.log(`Processing ${i + 1}/${regularPages.length}: ${url}`);
        }
        try {
          await exportPdf(url, filePath);
        } catch (error) {
          if (LOG_ERRORS) {
            console.error(`Failed to export ${url}:`, error);
          }
        }
      })
    );
  } else {
    // Process PDFs in batches
    for (let i = 0; i < regularPages.length; i += BATCH_SIZE) {
      const batch = regularPages.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(regularPages.length / BATCH_SIZE);

      if (LOG_BATCH_INFO) {
        console.log(
          `\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} pages)...`
        );
      }

      await Promise.allSettled(
        batch.map(async ({ url, filePath }, batchIndex) => {
          const globalIndex = i + batchIndex;
          if (LOG_PROGRESS) {
            console.log(`  [${globalIndex + 1}/${regularPages.length}] ${url}`);
          }
          try {
            await exportPdf(url, filePath);
          } catch (error) {
            if (LOG_ERRORS) {
              console.error(`  Failed to export ${url}:`, error);
            }
          }
        })
      );

      // Add delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < regularPages.length) {
        if (LOG_DELAYS) {
          console.log(`  Waiting before next batch...`);
        }
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }
  }
} else {
  // Process PDFs sequentially to avoid overwhelming Next.js image optimization
  for (let i = 0; i < regularPages.length; i++) {
    const { url, filePath } = regularPages[i];
    if (LOG_PROGRESS) {
      console.log(`\nProcessing ${i + 1}/${regularPages.length}: ${url}`);
    }
    try {
      await exportPdf(url, filePath);
      // Add delay between pages to give server time to recover
      if (i < regularPages.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, SEQUENTIAL_PAGE_DELAY)
        );
      }
    } catch (error) {
      if (LOG_ERRORS) {
        console.error(`Failed to export ${url}:`, error);
      }
      // Continue with next page even if one fails
    }
  }
}

if (LOG_SUCCESS) {
  console.log("\nAll PDFs exported successfully!");
}
await browser.close();
