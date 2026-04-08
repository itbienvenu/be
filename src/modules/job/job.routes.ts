import JobController from "./job.controller.js";
import { Router } from "express";

export class JobRoutes {
    public router: Router;
    private jobController: JobController;

    constructor() {
        this.router = Router();
        this.jobController = new JobController();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post("/", (req, res) => this.jobController.createJob(req, res));
    }
}

export default JobRoutes;