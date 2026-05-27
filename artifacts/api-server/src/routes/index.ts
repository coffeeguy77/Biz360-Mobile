import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stitchRouter from "./stitch";
import biz360Router from "./biz360";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stitchRouter);
router.use(biz360Router);

export default router;
