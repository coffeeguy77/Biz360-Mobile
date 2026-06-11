import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stitchRouter from "./stitch";
import biz360Router from "./biz360";
import valuationRouter from "./valuation/index";
import leaseAnalysisRouter from "./lease-analysis/index";
import leaseTemplatesRouter from "./lease-templates/index";
import sellerLeasesRouter from "./seller-leases/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stitchRouter);
router.use(biz360Router);
router.use(valuationRouter);
router.use(leaseAnalysisRouter);
router.use(leaseTemplatesRouter);
router.use(sellerLeasesRouter);

export default router;
