import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import healthRouter from "./health";
import downloadRouter from "./download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(downloadRouter);

router.get("/project/zip", (_req, res) => {
  const zipPath = path.resolve("/home/runner/workspace/mediagrab-core.zip");
  if (!fs.existsSync(zipPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="mediagrab-core.zip"');
  fs.createReadStream(zipPath).pipe(res);
});

export default router;
