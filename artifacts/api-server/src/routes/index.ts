import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stitchRouter from "./stitch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stitchRouter);

export default router;
