import fs from "fs";
import path from "path";
import { pool } from "../config/db";

/**
 * Service to automatically remove order bill images older than 6 months (180 days)
 * from both physical storage (uploads/ directory) and database records.
 */
export const cleanupOldImages = async (): Promise<{
  deletedFiles: number;
  updatedDbOrders: number;
  message: string;
}> => {
  let deletedFiles = 0;
  let updatedDbOrders = 0;

  try {
    const uploadsDir = path.join(__dirname, "../../uploads");
    const sixMonthsAgoMs = 180 * 24 * 60 * 60 * 1000; // 180 days in milliseconds
    const now = Date.now();

    console.log("[Image Cleanup] Starting 6-month image cleanup routine...");

    // 1. Delete physical files from uploads/ folder older than 6 months
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        // Skip hidden files
        if (file.startsWith(".")) continue;

        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            const ageMs = now - stats.mtimeMs;
            if (ageMs > sixMonthsAgoMs) {
              fs.unlinkSync(filePath);
              deletedFiles++;
              console.log(`[Image Cleanup] Removed file older than 6 months: ${file}`);
            }
          }
        } catch (fileErr) {
          console.warn(`[Image Cleanup] Could not check/delete file ${file}:`, fileErr);
        }
      }
    }

    // 2. Clear bill_image_url in PostgreSQL database for orders older than 6 months
    // Keep order and bill_amount intact, but remove image data / URL
    const dbResult = await pool.query(`
      UPDATE material_orders
      SET bill_image_url = NULL,
          notes = CASE 
            WHEN bill_image_url IS NOT NULL AND notes NOT LIKE '%(6 महिन्यांपूर्वीचे बिल हटवले)%' 
            THEN COALESCE(notes, '') || ' [६ महिन्यांपेक्षा जुने असल्याने बिलाचा फोटो नियमानुसार सर्व्हरवरून हटवला आहे]'
            ELSE notes 
          END,
          updated_at = NOW()
      WHERE (created_at < NOW() - INTERVAL '6 months' OR order_date < CURRENT_DATE - INTERVAL '6 months')
        AND bill_image_url IS NOT NULL
      RETURNING id;
    `);

    updatedDbOrders = dbResult.rowCount || 0;

    const message = `६ महिन्यांपेक्षा जुने फोटो सर्व्हरवरून यशस्वीरित्या हटवले: ${deletedFiles} फाईल्स आणि ${updatedDbOrders} डेटाबेस नोंदी अपडेट केल्या.`;
    console.log(`[Image Cleanup] Success: ${message}`);

    return {
      deletedFiles,
      updatedDbOrders,
      message,
    };
  } catch (error: any) {
    console.error("[Image Cleanup] Error running cleanup:", error);
    throw error;
  }
};
