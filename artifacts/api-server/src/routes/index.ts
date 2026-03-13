import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import categoriesRouter from "./categories.js";
import productsRouter from "./products.js";
import invoicesRouter from "./invoices.js";
import customersRouter from "./customers.js";
import deliveriesRouter from "./deliveries.js";
import damagedRouter from "./damaged.js";
import damageRecordsRouter from "./damageRecords.js";
import transfersRouter from "./transfers.js";
import reportsRouter from "./reports.js";
import historyRouter from "./history.js";
import backupRouter from "./backup.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/invoices", invoicesRouter);
router.use("/customers", customersRouter);
router.use("/deliveries", deliveriesRouter);
router.use("/damaged", damagedRouter);
router.use("/damage-records", damageRecordsRouter);
router.use("/transfers", transfersRouter);
router.use("/reports", reportsRouter);
router.use("/history", historyRouter);
router.use("/backup", backupRouter);

export default router;
